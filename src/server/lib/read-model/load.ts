/**
 * The database side of the shared read model: the rows of one tenant, read inside `withTenant`, become the same
 * `ReadModel` the mock API builds from the fixtures, so `src/read-model` answers both.
 *
 * Every row is parsed with its contract, so a value the database could not guard (a moment, an amount's shape) fails
 * loudly here and not on a screen. Rows come back in the order the fixture gave them (`row_no`); tasks in id order.
 */
import { sql } from 'kysely';

import { DATA_SETS, ENTITIES, ENTITY_NAMES, PersonaId, Task, TaskAuditEntry, instantOf, isDataSetId } from '../../../contracts/index.js';
import type { DataIssue, EntityName, TaskRecord } from '../../../contracts/index.js';
import { parseRuleConfig } from '../../../rules/index.js';
import type { DatasetRecords, ReadModel } from '../../../read-model/index.js';
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

/** A task row with its audit rows (oldest first) as the contracts' `TaskRecord`. */
export function taskRecord(taskRow: Row, auditRows: readonly Row[]): TaskRecord {
  const task = Task.parse({ ...taskRow, updated_at: instantOf(taskRow.updated_at as Date) });
  return { ...task, audit: auditRows.filter((row) => row.task_id === task.task_id).map(auditEntry) };
}

export async function loadAuditRows(scope: TenantScope, taskId?: string): Promise<Row[]> {
  const only = taskId === undefined ? sql`true` : sql`task_id = ${taskId}`;
  const result = await sql<Row>`select * from task_audit_entries where ${tenantPredicate('task_audit_entries', scope.tenantId)} and ${only} order by audit_id`.execute(scope.db);
  return result.rows;
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
  const audit = await loadAuditRows(scope);
  const tasks = (rows.get('task') ?? []).map((row) => taskRecord(row, audit));

  const configRow = await scope
    .selectFrom('rule_configs')
    .select('config')
    .where('data_set', '=', tenant.dataset_tag)
    .executeTakeFirst();
  if (configRow === undefined) {
    throw new Error(`Tenant ${scope.tenantId} has no rule configuration.`);
  }
  const issueRows = await scope.selectFrom('data_issues').selectAll().orderBy('issue_no').execute();
  const issues: DataIssue[] = issueRows.map(({ tenant_id: _tenant, source_row, ...issue }) => ({
    ...issue,
    kind: issue.kind as DataIssue['kind'],
    row: source_row,
  }));

  return { tenantId: scope.tenantId, records, tasks, ruleConfig: parseRuleConfig(configRow.config), issues };
}
