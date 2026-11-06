import { describe, expect, it } from 'vitest';

import { endpoints } from '../contracts/index.js';
import type { DataSetId, EndpointContract, PersonaId } from '../contracts/index.js';
import { createMockApi } from './api.js';
import { memoryStore } from './storage.js';
import { readFixtureFiles, readFixtureJson } from './test-support/fixtureFiles.js';

const FIXTURES = { TEST: readFixtureFiles('test'), DEMO: readFixtureFiles('demo') };

interface CallOptions {
  readonly tenant?: string | null;
  readonly asOf?: string;
  readonly persona?: PersonaId;
  readonly key?: string;
  readonly path?: Record<string, string>;
  readonly query?: Record<string, string>;
  readonly body?: unknown;
}

function client(storage = memoryStore(), now = () => new Date('2026-11-06T12:00:00Z')) {
  const api = createMockApi({ fixtures: FIXTURES, storage, ruleConfig: readFixtureJson('proposed_rule_config.json'), now });
  return {
    storage,
    /** Calls an endpoint and checks the answer against its contract schema. */
    async call<R, Q, B>(endpoint: EndpointContract<R, Q, B>, options: CallOptions = {}): Promise<{ status: number; body: R }> {
      let path = endpoint.path.replace(/:(\w+)/g, (_m, name: string) => options.path?.[name] ?? name);
      if (options.query) path += `?${new URLSearchParams(options.query).toString()}`;
      const headers: Record<string, string> = {};
      if (options.tenant !== null) headers['X-Tenant-Id'] = options.tenant ?? 'TEST';
      if (options.asOf) headers['X-As-Of'] = options.asOf;
      if (options.persona) headers['X-Persona'] = options.persona;
      if (options.key) headers['Idempotency-Key'] = options.key;
      const init: RequestInit = { method: endpoint.method, headers };
      if (options.body !== undefined) init.body = JSON.stringify(options.body);
      const response = await api.fetch(path, init);
      const json: unknown = await response.json();
      return { status: response.status, body: response.ok ? endpoint.response.parse(json) : (json as R) };
    },
  };
}

describe('the mock API', () => {
  it('serves every read of the active tenant only, as contract-valid raw records, and refuses a missing or unknown tenant', async () => {
    const api = client();
    const reads = [
      (tenant: DataSetId) => api.call(endpoints.claimsList, { tenant }),
      (tenant: DataSetId) => api.call(endpoints.policiesList, { tenant }),
      (tenant: DataSetId) => api.call(endpoints.clientsList, { tenant }),
      (tenant: DataSetId) => api.call(endpoints.brokersList, { tenant }),
      (tenant: DataSetId) => api.call(endpoints.productsList, { tenant }),
      (tenant: DataSetId) => api.call(endpoints.invoicesList, { tenant }),
      (tenant: DataSetId) => api.call(endpoints.suppliersList, { tenant }),
      (tenant: DataSetId) => api.call(endpoints.usersList, { tenant }),
    ];

    for (const tenant of ['TEST', 'DEMO'] as const satisfies readonly DataSetId[]) {
      for (const read of reads) {
        const { status, body } = await read(tenant);
        expect(status).toBe(200);
        expect(body.tenant_id).toBe(tenant);
        expect(body.items.length).toBeGreaterThan(0);
        expect(body.items.every((row) => row.tenant_id === tenant)).toBe(true);
      }
    }
    const claims = {
      TEST: await api.call(endpoints.claimsList, { tenant: 'TEST' }),
      DEMO: await api.call(endpoints.claimsList, { tenant: 'DEMO' }),
    };
    expect([claims.TEST.body.items.length, claims.DEMO.body.items.length]).toEqual([6, 30]);
    const invoices = {
      TEST: await api.call(endpoints.invoicesList, { tenant: 'TEST' }),
      DEMO: await api.call(endpoints.invoicesList, { tenant: 'DEMO' }),
    };
    expect([invoices.TEST.body.items.length, invoices.DEMO.body.items.length]).toEqual([6, 36]);

    const clm106 = await api.call(endpoints.claimsGet, { path: { claimId: 'CLM-106' } });
    expect(clm106.body.item).toMatchObject({ claim_id: 'CLM-106', current_outstanding_reserve: '30000.00' });
    expect(clm106.body.item.events.length).toBeGreaterThan(0);
    expect(clm106.body.item.supplier_requests.map((r) => r.request_id)).toEqual(['REQ-CLM-106']);
    expect((await api.call(endpoints.claimsGet, { tenant: 'DEMO', path: { claimId: 'CLM-106' } })).status).toBe(404);
    const inv001 = (await api.call(endpoints.invoicesList)).body.items.find((i) => i.invoice_id === 'INV-001');
    expect(inv001?.allocations.map((a) => a.allocated_amount)).toEqual(['6000.00']);
    expect(inv001?.receipts.map((r) => r.receipt_id)).toEqual(['RCP-001']);

    const issues = await api.call(endpoints.dataIssues, { tenant: 'DEMO' });
    expect(issues.body).toMatchObject({ tenant_id: 'DEMO', quarantined_rows: 0, issues: [] });
    expect((await api.call(endpoints.claimsList, { tenant: null })).status).toBe(400);
    expect((await api.call(endpoints.claimsList, { tenant: 'OTHER' })).status).toBe(403);
  });

  it('reads as of the chosen date: later records are not shown, the default is 2026-10-21, a bad date is refused', async () => {
    const api = client();

    const byDefault = await api.call(endpoints.claimsList);
    expect(byDefault.body.as_of).toBe('2026-10-21');
    expect(byDefault.body.items).toHaveLength(6);

    const early = await api.call(endpoints.claimsList, { asOf: '2026-10-05' });
    expect(early.body.as_of).toBe('2026-10-05');
    expect(early.body.items.map((c) => c.claim_id).sort()).toEqual(['CLM-101', 'CLM-102', 'CLM-106']);
    const clm101 = early.body.items.find((c) => c.claim_id === 'CLM-101');
    expect(clm101?.events.map((e) => e.event_at)).toEqual(['2026-10-01', '2026-10-03']);
    const full = byDefault.body.items.find((c) => c.claim_id === 'CLM-101');
    expect(full?.reserve_events.length).toBeGreaterThan(clm101?.reserve_events.length ?? 99);

    const invoices = await api.call(endpoints.invoicesList, { asOf: '2026-09-30' });
    expect(invoices.body.items).toHaveLength(6);
    expect(invoices.body.items.flatMap((i) => i.allocations.map((a) => a.allocation_id)).sort()).toEqual(['ALLOC-001', 'ALLOC-002']);

    expect((await api.call(endpoints.claimsList, { asOf: '2026-02-30' })).status).toBe(400);

    const later = { persona: 'finance', body: { subject_type: 'CLAIM', subject_id: 'CLM-105' } } as const;
    expect((await api.call(endpoints.tasksCreate, { ...later, asOf: '2026-10-05' })).status).toBe(422);
    expect((await api.call(endpoints.tasksCreate, later)).status).toBe(201);
  });

  it('keeps a created task across a refresh, records every change with actor and time, rejects bad input, and Reset restores the fixture', async () => {
    const first = client();
    const create = {
      persona: 'head-of-claims',
      key: 'create-1',
      body: { subject_type: 'CLAIM', subject_id: 'CLM-106', priority: 'HIGH', note: 'Chase the repairer' },
    } as const;

    expect((await first.call(endpoints.tasksList)).body.items).toEqual([]);
    const created = await first.call(endpoints.tasksCreate, create);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ task_id: 'TASK-0001', status: 'OPEN', assigned_to: null, module: 'CLAIMS', priority: 'HIGH' });
    expect(created.body.audit).toEqual([
      { task_id: 'TASK-0001', at: '2026-11-06T14:00:00+02:00', actor: 'head-of-claims', action: 'CREATED', from: null, to: 'OPEN', note: 'Chase the repairer' },
    ]);
    expect((await first.call(endpoints.tasksCreate, create)).body.task_id).toBe('TASK-0001');
    expect((await first.call(endpoints.tasksList)).body.items).toHaveLength(1);

    const users = (await first.call(endpoints.usersList)).body.items;
    const handler = users.find((u) => u.role === 'Claims Handler')?.user_id ?? '';
    await first.call(endpoints.tasksAssign, { persona: 'claims-handler', path: { taskId: 'TASK-0001' }, body: { assigned_to: handler } });
    await first.call(endpoints.tasksSetStatus, { persona: 'claims-handler', path: { taskId: 'TASK-0001' }, body: { status: 'DONE', note: 'Repairer replied' } });

    const bad = await first.call(endpoints.tasksCreate, { persona: 'finance', body: { subject_type: 'CLAIM', subject_id: 'CLM-999' } });
    expect(bad.status).toBe(422);
    expect(bad.body).toMatchObject({ errors: [{ field: 'subject_id' }] });
    expect((await first.call(endpoints.tasksAssign, { persona: 'finance', path: { taskId: 'TASK-0001' }, body: { assigned_to: 'USR-NOPE' } })).status).toBe(422);
    expect((await first.call(endpoints.tasksCreate, { body: create.body })).status).toBe(400);
    expect((await first.call(endpoints.tasksSetStatus, { persona: 'finance', path: { taskId: 'TASK-9' }, body: { status: 'DONE' } })).status).toBe(404);

    const refreshed = client(first.storage);
    const [task] = (await refreshed.call(endpoints.tasksList)).body.items;
    expect(task).toMatchObject({ task_id: 'TASK-0001', status: 'DONE', assigned_to: handler });
    expect(task?.audit.map((a) => [a.action, a.actor, a.from, a.to])).toEqual([
      ['CREATED', 'head-of-claims', null, 'OPEN'],
      ['ASSIGNED', 'claims-handler', null, handler],
      ['STATUS_CHANGED', 'claims-handler', 'OPEN', 'DONE'],
    ]);
    expect((await refreshed.call(endpoints.tasksList, { query: { status: 'OPEN' } })).body.items).toEqual([]);
    expect((await refreshed.call(endpoints.tasksList, { tenant: 'DEMO' })).body.items).toEqual([]);
    expect((await refreshed.call(endpoints.tasksList, { query: { status: 'FINISHED' } })).status).toBe(400);

    const claimsBefore = (await refreshed.call(endpoints.claimsList)).body;
    expect((await refreshed.call(endpoints.demoReset)).body).toEqual({ tenant_id: 'TEST', reset: true });
    expect((await refreshed.call(endpoints.tasksList)).body.items).toEqual([]);
    expect((await client(first.storage).call(endpoints.tasksList)).body.items).toEqual([]);
    expect((await refreshed.call(endpoints.claimsList)).body).toEqual(claimsBefore);
    expect((await refreshed.call(endpoints.tasksCreate, { ...create, key: 'create-2' })).body.task_id).toBe('TASK-0001');
  });
});
