/**
 * Replaces everything a data set owns in the database with the loaded fixture: the seed (`bun run db:seed`) and the
 * demo reset of the API both call it, so Reset restores exactly what the seed made. The tenant's memberships are not
 * lost: they are the accounts, not the data. Removing a tenant row removes its memberships with it, so they are kept
 * aside and put back (or replaced by `memberships`, which the seed passes).
 *
 * It runs in a transaction the caller opened as the owner: the application role may delete neither tasks nor their
 * audit trail.
 */
import { sql } from 'kysely';

import { ENTITIES, ENTITY_NAMES, PersonaId } from '../../../contracts/index.js';
import type { EntityName } from '../../../contracts/index.js';
import { RuleConfig } from '../../../rules/index.js';
import type { LoadedDataset } from '../../../read-model/index.js';
import { ENTITY_TABLES } from '../db/entityTables.js';
import type { DbTransaction } from '../db/index.js';

/** The tables a tenant's data owns beyond the 17 entities, in the order their rows can be deleted. */
const DATA_TABLES = ['rule_configs', 'data_issues', 'task_audit_entries', 'task_counters'] as const;

const ROWS_PER_STATEMENT = 500;

async function insertRows(trx: DbTransaction, name: EntityName, rows: readonly object[]): Promise<void> {
  const table = sql.table(ENTITY_TABLES[name]);
  const columns = sql.join(Object.keys(ENTITIES[name].schema.shape).map((column) => sql.ref(column)));
  for (let start = 0; start < rows.length; start += ROWS_PER_STATEMENT) {
    const chunk = JSON.stringify(rows.slice(start, start + ROWS_PER_STATEMENT));
    await sql`insert into ${table} (${columns}) select ${columns} from jsonb_populate_recordset(null::${table}, ${chunk}::jsonb)`.execute(trx);
  }
}

export interface Membership {
  readonly authUserId: string;
  readonly persona: PersonaId;
}

export async function replaceDataSetRows(
  trx: DbTransaction,
  data: LoadedDataset,
  ruleConfig: unknown,
  memberships?: readonly Membership[],
): Promise<void> {
  const tenantId = data.tenant.tenant_id;
  RuleConfig.parse(ruleConfig);
  const kept: readonly Membership[] =
    memberships ??
    (await trx.selectFrom('tenant_memberships').select(['auth_user_id', 'persona']).where('tenant_id', '=', tenantId).execute()).map((row) => ({
      authUserId: row.auth_user_id,
      persona: PersonaId.parse(row.persona),
    }));

  for (const table of DATA_TABLES) {
    await trx.deleteFrom(table).where('tenant_id', '=', tenantId).execute();
  }
  for (const name of [...ENTITY_NAMES].reverse()) {
    await trx.deleteFrom(ENTITY_TABLES[name]).where('tenant_id', '=', tenantId).execute();
  }
  for (const name of ENTITY_NAMES) {
    await insertRows(trx, name, data.records[name]);
  }
  if (data.issues.length > 0) {
    await trx
      .insertInto('data_issues')
      .values(
        data.issues.map(({ row, ...issue }) => ({ tenant_id: tenantId, ...issue, source_row: row })),
      )
      .execute();
  }
  await trx.insertInto('rule_configs').values({ tenant_id: tenantId, data_set: data.dataSet, config: JSON.stringify(ruleConfig) }).execute();
  const lastTask = Math.max(0, ...data.records.task.map((task) => Number(/^TASK-(\d+)$/.exec(task.task_id)?.[1] ?? 0)));
  await trx.insertInto('task_counters').values({ tenant_id: tenantId, next_number: lastTask + 1 }).execute();
  if (kept.length > 0) {
    await trx
      .insertInto('tenant_memberships')
      .values(kept.map((membership) => ({ tenant_id: tenantId, auth_user_id: membership.authUserId, persona: membership.persona })))
      .execute();
  }
}
