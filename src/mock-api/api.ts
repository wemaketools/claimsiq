/**
 * The mock API: implements the typed endpoints of `src/contracts` over the parsed fixtures and runs in the browser
 * for Stage A. `fetch` has the shape of the platform `fetch`, so the SPA's API client calls it through its transport
 * adapter and a real server can replace it without a UI change.
 *
 * Reads return the raw records of the tenant in `X-Tenant-Id`. Claims and their child records, receipts, allocations
 * and payment attempts are limited to those dated on or before `X-As-Of`; master data, invoices and tasks are not.
 * Nothing is rewritten; the one computed read is `claims.facts`, which runs the rules engine (`src/rules`) over the same
 * as-of records, narrowed first by the query (policy, broker, product, handler). Commands change a copy kept in
 * `KeyValueStore` and never the fixture.
 */
import type { z } from 'zod';

import {
  AS_OF_HEADER,
  DEFAULT_AS_OF,
  PERSONA_HEADER,
  PersonaId,
  TENANT_HEADER,
  endpoints,
  instantOf,
  isDataSetId,
  isRealDate,
} from '../contracts/index.js';
import type {
  DataSetId,
  EndpointContract,
  TaskAuditEntry,
  TaskRecord,
} from '../contracts/index.js';
import { breakdownOfOpenClaims, computeClaimsFacts, parseRuleConfig } from '../rules/index.js';
import { claimRecords, invoiceRecords } from './asOfViews.js';
import { changesKey, clearChanges, readChanges, taskIdOf, writeChanges } from './changes.js';
import type { Changes } from './changes.js';
import { loadDataset } from './fixtures/index.js';
import type { FixtureFiles, LoadedDataset } from './fixtures/index.js';
import { HttpProblem, jsonResponse, problemResponse } from './problem.js';
import type { FieldProblem } from './problem.js';
import type { KeyValueStore } from './storage.js';

export interface MockApiOptions {
  readonly fixtures: Readonly<Record<DataSetId, FixtureFiles>>;
  readonly storage: KeyValueStore;
  /** The rule config as JSON (`fixtures/v1/proposed_rule_config.json`); an invalid one fails when the API is created. */
  readonly ruleConfig: unknown;
  readonly now?: () => Date;
}

export interface MockApi {
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

interface Context<Q, B> {
  readonly data: LoadedDataset;
  readonly asOf: string;
  readonly actor: PersonaId | null;
  readonly query: Q;
  readonly body: B;
  readonly params: Readonly<Record<string, string>>;
  readonly idempotencyKey: string | null;
  readonly now: Date;
}

interface Route {
  readonly endpoint: EndpointContract<unknown, unknown, unknown>;
  readonly pattern: RegExp;
  readonly names: readonly string[];
  readonly status: number;
  readonly run: (context: Context<unknown, unknown>) => unknown;
}

function fieldProblems(error: z.ZodError): FieldProblem[] {
  return error.issues.map((issue) => ({ field: issue.path.join('.'), code: issue.code, message: issue.message }));
}

function compile(path: string): { pattern: RegExp; names: string[] } {
  const names: string[] = [];
  const source = path.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  return { pattern: new RegExp(`^${source}$`), names };
}

export function createMockApi(options: MockApiOptions): MockApi {
  const clock = options.now ?? (() => new Date());
  const ruleConfig = parseRuleConfig(options.ruleConfig);
  const loaded = new Map<DataSetId, LoadedDataset>();
  const routes: Route[] = [];

  const dataFor = (dataSet: DataSetId): LoadedDataset => {
    let data = loaded.get(dataSet);
    if (data === undefined) {
      data = loadDataset(dataSet, options.fixtures[dataSet]);
      loaded.set(dataSet, data);
    }
    return data;
  };

  function route<R, Q, B>(
    endpoint: EndpointContract<R, Q, B>,
    run: (context: Context<Q, B>) => R,
    settings: { status?: number } = {},
  ): void {
    const { pattern, names } = compile(endpoint.path);
    routes.push({
      endpoint: endpoint as EndpointContract<unknown, unknown, unknown>,
      pattern,
      names,
      status: settings.status ?? 200,
      run: run as (context: Context<unknown, unknown>) => unknown,
    });
  }

  const storeKey = (data: LoadedDataset): string => changesKey(data.dataSet, data.tenant.tenant_id);
  const readAll = (data: LoadedDataset): Changes => readChanges(options.storage, storeKey(data));
  const save = (data: LoadedDataset, changes: Changes): void => {
    try {
      writeChanges(options.storage, storeKey(data), changes);
    } catch {
      throw new HttpProblem(507, 'The browser storage is full or unavailable, so the change was not saved.');
    }
  };

  const read = <T>(context: Context<unknown, unknown>, items: readonly T[]) => ({
    tenant_id: context.data.tenant.tenant_id,
    as_of: context.asOf,
    items: [...items],
  });

  function allTasks(data: LoadedDataset, changes: Changes): TaskRecord[] {
    const changed = new Set(changes.tasks.map((task) => task.task_id));
    const fixture = data.records.task.filter((task) => !changed.has(task.task_id)).map((task) => ({ ...task, audit: [] }));
    return [...fixture, ...changes.tasks];
  }

  const fail = (field: string, message: string): never => {
    throw new HttpProblem(422, 'The request has invalid values.', [{ field, code: 'invalid', message }]);
  };

  function requireActor(context: Context<unknown, unknown>): PersonaId {
    if (context.actor === null) {
      throw new HttpProblem(400, `${PERSONA_HEADER} must name the persona acting.`);
    }
    return context.actor;
  }

  function requireUser(data: LoadedDataset, field: string, userId: string): void {
    if (!data.records.user.some((user) => user.user_id === userId)) {
      fail(field, `User "${userId}" does not exist in this data set.`);
    }
  }

  function findTask(data: LoadedDataset, changes: Changes, taskId: string): TaskRecord {
    const task = allTasks(data, changes).find((candidate) => candidate.task_id === taskId);
    if (task === undefined) {
      throw new HttpProblem(404, `Task "${taskId}" does not exist.`);
    }
    return task;
  }

  function putTask(changes: Changes, task: TaskRecord): void {
    const others = changes.tasks.filter((existing) => existing.task_id !== task.task_id);
    changes.tasks = [...others, task];
  }

  const subjectExists = (data: LoadedDataset, asOf: string, type: string, id: string): boolean => {
    switch (type) {
      case 'CLAIM':
        return claimRecords(data, asOf, id).length > 0;
      case 'POLICY':
        return data.records.policy.some((row) => row.policy_id === id);
      case 'INVOICE':
        return data.records.invoice.some((row) => row.invoice_id === id);
      default:
        return data.records.supplier.some((row) => row.supplier_id === id);
    }
  };

  function audit(task: TaskRecord, entry: Omit<TaskAuditEntry, 'task_id'>): TaskRecord {
    return { ...task, audit: [...task.audit, { task_id: task.task_id, ...entry }] };
  }

  route(endpoints.claimsList, (c) => read(c, claimRecords(c.data, c.asOf)));
  route(endpoints.claimsGet, (c) => {
    const claimId = c.params.claimId;
    const [item] = claimRecords(c.data, c.asOf, claimId);
    if (item === undefined) {
      throw new HttpProblem(404, `Claim "${claimId ?? ''}" does not exist as of ${c.asOf}.`);
    }
    return { tenant_id: c.data.tenant.tenant_id, as_of: c.asOf, item };
  });
  route(endpoints.claimsFacts, (c) => {
    const { policy_id, broker_id, product_id, handler_id, period } = c.query;
    const policies = new Map(c.data.records.policy.map((policy) => [policy.policy_id, policy]));
    const claims = claimRecords(c.data, c.asOf).filter((claim) => {
      const policy = policies.get(claim.policy_id);
      return (
        (policy_id === undefined || claim.policy_id === policy_id) &&
        (handler_id === undefined || claim.handler_id === handler_id) &&
        (broker_id === undefined || policy?.broker_id === broker_id) &&
        (product_id === undefined || policy?.product_id === product_id)
      );
    });
    const { items, summary } = computeClaimsFacts(claims, { asOf: c.asOf, config: ruleConfig, period });
    return {
      tenant_id: c.data.tenant.tenant_id,
      as_of: c.asOf,
      items,
      summary,
      breakdowns: {
        products: breakdownOfOpenClaims(items, (fact) => policies.get(fact.policy_id)?.product_id ?? null),
        brokers: breakdownOfOpenClaims(items, (fact) => policies.get(fact.policy_id)?.broker_id ?? null),
        handlers: breakdownOfOpenClaims(items, (fact) => fact.handler_id),
      },
    };
  });
  route(endpoints.policiesList, (c) => read(c, c.data.records.policy));
  route(endpoints.clientsList, (c) => read(c, c.data.records.client));
  route(endpoints.brokersList, (c) => read(c, c.data.records.broker));
  route(endpoints.productsList, (c) => read(c, c.data.records.product));
  route(endpoints.invoicesList, (c) => read(c, invoiceRecords(c.data, c.asOf)));
  route(endpoints.suppliersList, (c) => read(c, c.data.records.supplier));
  route(endpoints.usersList, (c) => read(c, c.data.records.user));
  route(endpoints.tasksList, (c) => {
    const { subject_type, subject_id, assigned_to, status } = c.query;
    const tasks = allTasks(c.data, readAll(c.data))
      .filter((task) => subject_type === undefined || task.subject_type === subject_type)
      .filter((task) => subject_id === undefined || task.subject_id === subject_id)
      .filter((task) => assigned_to === undefined || task.assigned_to === assigned_to)
      .filter((task) => status === undefined || task.status === status);
    return read(c, tasks);
  });

  route(
    endpoints.tasksCreate,
    (c) => {
      const actor = requireActor(c);
      const changes = readAll(c.data);
      const earlierId = c.idempotencyKey === null ? undefined : changes.created_by_key[c.idempotencyKey];
      if (earlierId !== undefined) {
        return findTask(c.data, changes, earlierId);
      }
      const { subject_type, subject_id, assigned_to } = c.body;
      if (!subjectExists(c.data, c.asOf, subject_type, subject_id)) {
        fail('subject_id', `${subject_type.toLowerCase()} "${subject_id}" does not exist in this data set as of ${c.asOf}.`);
      }
      if (assigned_to !== null) {
        requireUser(c.data, 'assigned_to', assigned_to);
      }
      const taken = new Set(allTasks(c.data, changes).map((task) => task.task_id));
      let number = changes.next_task_number;
      while (taken.has(taskIdOf(number))) number += 1;
      const taskId = taskIdOf(number);
      const at = instantOf(c.now);
      const created: TaskRecord = audit(
        {
          tenant_id: c.data.tenant.tenant_id,
          task_id: taskId,
          module: c.body.module,
          subject_type,
          subject_id,
          assigned_to,
          due_at: c.body.due_at,
          priority: c.body.priority,
          status: 'OPEN',
          note: c.body.note,
          updated_at: at,
          audit: [],
        },
        { at, actor, action: 'CREATED', from: null, to: 'OPEN', note: c.body.note },
      );
      putTask(changes, created);
      changes.next_task_number = number + 1;
      if (c.idempotencyKey !== null) {
        changes.created_by_key[c.idempotencyKey] = taskId;
      }
      save(c.data, changes);
      return created;
    },
    { status: 201 },
  );

  route(
    endpoints.tasksAssign,
    (c) => {
      const actor = requireActor(c);
      const changes = readAll(c.data);
      const task = findTask(c.data, changes, c.params.taskId ?? '');
      requireUser(c.data, 'assigned_to', c.body.assigned_to);
      if (task.assigned_to === c.body.assigned_to) {
        return task;
      }
      const at = instantOf(c.now);
      const updated = audit(
        { ...task, assigned_to: c.body.assigned_to, updated_at: at },
        { at, actor, action: 'ASSIGNED', from: task.assigned_to, to: c.body.assigned_to, note: null },
      );
      putTask(changes, updated);
      save(c.data, changes);
      return updated;
    },
  );

  route(
    endpoints.tasksSetStatus,
    (c) => {
      const actor = requireActor(c);
      const changes = readAll(c.data);
      const task = findTask(c.data, changes, c.params.taskId ?? '');
      if (task.status === c.body.status) {
        return task;
      }
      const at = instantOf(c.now);
      const updated = audit(
        { ...task, status: c.body.status, updated_at: at },
        { at, actor, action: 'STATUS_CHANGED', from: task.status, to: c.body.status, note: c.body.note },
      );
      putTask(changes, updated);
      save(c.data, changes);
      return updated;
    },
  );

  route(endpoints.dataIssues, (c) => ({
    tenant_id: c.data.tenant.tenant_id,
    quarantined_rows: c.data.quarantinedRows,
    issues: [...c.data.issues],
  }));

  route(endpoints.demoReset, (c) => {
    clearChanges(options.storage, storeKey(c.data));
    return { tenant_id: c.data.tenant.tenant_id, reset: true as const };
  });

  async function handle(url: string, init: RequestInit): Promise<Response> {
    const parsed = new URL(url, 'http://mock-api.local');
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);

    const matched = routes.find((candidate) => candidate.endpoint.method === method && candidate.pattern.test(parsed.pathname));
    if (matched === undefined) {
      throw new HttpProblem(404, `No endpoint ${method} ${parsed.pathname}.`);
    }

    const tenant = headers.get(TENANT_HEADER);
    if (tenant === null) {
      throw new HttpProblem(400, `${TENANT_HEADER} is required.`);
    }
    if (!isDataSetId(tenant)) {
      throw new HttpProblem(403, `Tenant "${tenant}" is not available.`);
    }

    const asOf = headers.get(AS_OF_HEADER) ?? DEFAULT_AS_OF;
    if (!isRealDate(asOf)) {
      throw new HttpProblem(400, `${AS_OF_HEADER} must be a date as YYYY-MM-DD.`);
    }

    const actorHeader = headers.get(PERSONA_HEADER);
    const actor = PersonaId.safeParse(actorHeader);

    const names = matched.names;
    const values = matched.pattern.exec(parsed.pathname)?.slice(1) ?? [];
    const params = Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(values[index] ?? '')]));

    let query: unknown;
    if (matched.endpoint.query !== null) {
      const checked = matched.endpoint.query.safeParse(Object.fromEntries(parsed.searchParams));
      if (!checked.success) {
        throw new HttpProblem(400, 'The query has invalid values.', fieldProblems(checked.error));
      }
      query = checked.data;
    }

    let body: unknown;
    if (matched.endpoint.body !== null) {
      let payload: unknown;
      try {
        payload = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      } catch {
        throw new HttpProblem(400, 'The request body is not valid JSON.');
      }
      const checked = matched.endpoint.body.safeParse(payload);
      if (!checked.success) {
        throw new HttpProblem(422, 'The request has invalid values.', fieldProblems(checked.error));
      }
      body = checked.data;
    }

    const result = matched.run({
      data: dataFor(tenant),
      asOf,
      actor: actor.success ? actor.data : null,
      query,
      body,
      params,
      idempotencyKey: headers.get('Idempotency-Key'),
      now: clock(),
    });
    return jsonResponse(result, matched.status);
  }

  return {
    fetch: async (url, init = {}) => {
      try {
        return await handle(url, init);
      } catch (error) {
        if (error instanceof HttpProblem) {
          return problemResponse(error);
        }
        console.error('Mock API failure', error);
        return problemResponse(new HttpProblem(500, 'The mock API failed on this request.'));
      }
    },
  };
}
