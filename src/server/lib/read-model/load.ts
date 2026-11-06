/**
 * The database side of the shared read model: the rows of one tenant, read inside `withTenant`, become the same
 * `ReadModel` the mock API builds from the fixtures, so `src/read-model` answers both.
 *
 * Every row is parsed with its contract, so a value the database could not guard (a moment, an amount's shape) fails
 * loudly here and not on a screen. Rows come back in the order the fixture gave them (`row_no`); tasks in id order.
 */
import { sql } from 'kysely';

import { DATA_SETS, ENTITIES, ENTITY_NAMES, PersonaId, RuleConfigAuditEntry, Task, TaskAuditEntry, instantOf, isDataSetId } from '../../../contracts/index.js';
import type { DataIssue, EntityName, TaskRecord } from '../../../contracts/index.js';
import { parseRuleConfig } from '../../../rules/index.js';
import type { DatasetRecords, ReadModel, RuleConfigHistory } from '../../../read-model/index.js';
import { readFixtureJson } from '../seed/fixtureFiles.js';
import { ENTITY_TABLES, tenantPredicate } from '../db/index.js';
import type { TenantScope } from '../db/index.js';

type Row = Record<string, unknown>;

async function rowsOf(scope: TenantScope, name: EntityName): Promise<Row[]> {
  const table = ENTITY_TABLES[name];
  const order = name === 'task' ? sql`task_id collate "C"` : sql`row_no`;
  const result = await sql<Row>`select * from ${sql.table(table)} where ${tenantPredicate(table, scope.tenantId)} order by ${order}`.execute(scope.db);
  return result.rows;
}

const parsedRows = <E extends EntityName>(name: E, rows: readonly Row[]): DatasetRecords[E] =>
  rows.map((row) => ENTITIES[name].schema.parse(row)) as DatasetRecords[E];

export function auditEntry(row: Row): TaskAuditEntry {
  return TaskAuditEntry.parse({
    task_id: row.task_id,
    at: instantOf(row.at as Date),
    actor: PersonaId.parse(row.actor),
    action: row.action,
    from: row.from_value,
    to: row.to_value,
    note: row.note,
  });
}

/** A task row with the audit rows of that task (oldest first) as the contracts' `TaskRecord`. */
export function taskRecord(taskRow: Row, ownAuditRows: readonly Row[]): TaskRecord {
  const task = Task.parse({ ...taskRow, updated_at: instantOf(taskRow.updated_at as Date) });
  return { ...task, audit: ownAuditRows.map(auditEntry) };
}

export async function loadAuditRows(scope: TenantScope, taskId?: string): Promise<Row[]> {
  const only = taskId === undefined ? sql`true` : sql`task_id = ${taskId}`;
  const result = await sql<Row>`select * from task_audit_entries where ${tenantPredicate('task_audit_entries', scope.tenantId)} and ${only} order by audit_id`.execute(scope.db);
  return result.rows;
}

/** The tenant's rule config as the engine reads it, with the spec's defaults, the version and the audit of the saves. */
export async function loadRuleConfig(scope: TenantScope): Promise<{ ruleConfig: ReadModel['ruleConfig']; ruleHistory: RuleConfigHistory }> {
  const row = await scope.selectFrom('rule_configs').selectAll().executeTakeFirst();
  if (row === undefined) {
    throw new Error(`Tenant ${scope.tenantId} has no rule configuration.`);
  }
  const auditRows = await scope.selectFrom('rule_config_audit_entries').selectAll().orderBy('audit_id').execute();
  const audit = auditRows.map((entry) =>
    RuleConfigAuditEntry.parse({
      version: entry.version,
      at: instantOf(entry.at),
      actor: entry.actor,
      action: entry.action,
      field: entry.field,
      from: entry.from_value,
      to: entry.to_value,
    }),
  );
  return {
    ruleConfig: parseRuleConfig(row.config),
    ruleHistory: {
      defaults: parseRuleConfig(readFixtureJson('proposed_rule_config.json')),
      version: row.version,
      // A save always names its persona; a row without one is the config as seeded or restored by Reset.
      saved_at: row.updated_by === null ? null : instantOf(row.updated_at),
      saved_by: row.updated_by === null ? null : PersonaId.parse(row.updated_by),
      audit,
    },
  };
}

export async function loadReadModel(scope: TenantScope): Promise<ReadModel> {
  const entityRows = await Promise.all(ENTITY_NAMES.map(async (name) => [name, await rowsOf(scope, name)] as const));
  const rows = new Map<EntityName, Row[]>(entityRows);
  const records = Object.fromEntries(
    ENTITY_NAMES.filter((name) => name !== 'task').map((name) => [name, parsedRows(name, rows.get(name) ?? [])]),
  ) as unknown as Omit<DatasetRecords, 'task'>;

  const tenant = records.tenant[0];
  if (tenant === undefined || !isDataSetId(tenant.dataset_tag) || DATA_SETS[tenant.dataset_tag].tenant_id !== scope.tenantId) {
    throw new Error(`Tenant ${scope.tenantId} has no row in tenants.`);
  }
  const auditByTask = new Map<string, Row[]>();
  for (const row of await loadAuditRows(scope)) {
    const key = String(row.task_id);
    const own = auditByTask.get(key);
    if (own === undefined) auditByTask.set(key, [row]);
    else own.push(row);
  }
  const tasks = (rows.get('task') ?? []).map((row) => taskRecord(row, auditByTask.get(String(row.task_id)) ?? []));

  const issueRows = await scope.selectFrom('data_issues').selectAll().orderBy('issue_no').execute();
  const issues: DataIssue[] = issueRows.map(({ tenant_id: _tenant, source_row, ...issue }) => ({
    ...issue,
    kind: issue.kind as DataIssue['kind'],
    row: source_row,
  }));

  return { tenantId: scope.tenantId, records, tasks, ...(await loadRuleConfig(scope)), issues };
}
