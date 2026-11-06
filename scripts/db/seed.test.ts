/**
 * The migrations and the seed against a scratch database on the local Postgres (skipped without the stack; CI has it).
 */
import { readFileSync } from 'node:fs';

import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEMO_ACCOUNTS } from '../../src/contracts/demoAccounts.js';
import { z } from 'zod';

import { ENTITIES, ENTITY_NAMES, PERSONA_IDS, TaskAuditEntry } from '../../src/contracts/index.js';
import { withEdit } from '../../src/read-model/test-support/fixtureFiles.js';
import { readFixtureFiles, readFixtureJson } from '../../src/server/lib/seed/fixtureFiles.js';
import { renderSchema, SCHEMA_FILE } from './generate-types.js';
import { createScratchDatabase, reachableDatabaseUrl } from './scratchDatabase.js';
import type { ScratchDatabase } from './scratchDatabase.js';
import { ENTITY_TABLES } from '../../src/server/lib/db/index.js';
import { findPersonaAccounts, seedDataSet, seedFromFixtures } from './seed.js';

const serverUrl = await reachableDatabaseUrl();

interface Metrics {
  TEST: { claims: number; premium_invoices: number; issued_BWP: number; allocated_BWP: number; paid_to_date_BWP: number; outstanding_reserve_BWP: number };
  DEMO: { claims_count: number; invoice_count: number };
}
const metrics = readFixtureJson('expected_metrics.json') as Metrics;

describe.skipIf(serverUrl === null)('the Stage B database', () => {
  let scratch: ScratchDatabase;

  beforeAll(async () => {
    scratch = await createScratchDatabase(serverUrl ?? '');
  });
  afterAll(async () => {
    await scratch.drop();
  });

  it('puts every table under RLS with the tenant policy, closes it to the Supabase API roles, and matches the committed Kysely types', async () => {
    const tables = await sql<{ relname: string; relrowsecurity: boolean; policies: string }>`
      select c.relname, c.relrowsecurity,
             (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and p.policyname = 'tenant_isolation')::text as policies,
             has_table_privilege('anon', c.oid, 'select') as anon_reads,
             has_table_privilege('authenticated', c.oid, 'select') as authenticated_reads
        from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by c.relname`.execute(scratch.db);

    expect(tables.rows.map((row) => row.relname)).toEqual(
      expect.arrayContaining(ENTITY_NAMES.map((name) => ENTITY_TABLES[name])),
    );
    expect(tables.rows).toHaveLength(ENTITY_NAMES.length + 5);
    for (const row of tables.rows) {
      expect(row, row.relname).toMatchObject({ relrowsecurity: true, policies: '1', anon_reads: false, authenticated_reads: false });
    }
    expect(await scratch.withClient((client) => renderSchema(client))).toBe(readFileSync(SCHEMA_FILE, 'utf8'));
  });

  it('allows in every enum column exactly the values the contracts name', async () => {
    const columns: [table: string, column: string, values: readonly string[]][] = [
      ['tenant_memberships', 'persona', PERSONA_IDS],
      ['rule_configs', 'updated_by', PERSONA_IDS],
      ['task_audit_entries', 'actor', PERSONA_IDS],
      ['task_audit_entries', 'action', TaskAuditEntry.shape.action.options],
    ];
    for (const name of ENTITY_NAMES) {
      for (const [column, field] of Object.entries(ENTITIES[name].schema.shape)) {
        const type = field instanceof z.ZodNullable ? field.unwrap() : field;
        if (type instanceof z.ZodEnum) {
          columns.push([ENTITY_TABLES[name], column, type.options.map(String)]);
        }
      }
    }
    expect(columns.length).toBeGreaterThan(12);

    await scratch.withClient(async (client) => {
      for (const [table, column, values] of columns) {
        const { rows } = await client.query<{ def: string }>(
          `select pg_get_constraintdef(c.oid) as def from pg_constraint c, pg_attribute a
            where a.attrelid = $1::regclass and a.attname = $2 and c.contype = 'c'
              and ((c.conrelid = a.attrelid and c.conkey = array[a.attnum]) or c.contypid = a.atttypid)`,
          [table, column],
        );
        const allowed = rows.flatMap((row) => [...row.def.matchAll(/'([^']+)'::text/g)].map((match) => match[1]));
        expect([...allowed].sort(), `${table}.${column}`).toEqual([...values].sort());
      }
    });
  });

  it('seeds TEST and DEMO as separate tenants with the fixtures counts and figures, reports a quarantined row without inserting it, and replaces the data set on a second run', async () => {
    const { db } = scratch;
    for (const account of DEMO_ACCOUNTS) {
      await sql`insert into auth.users (email) values (${account.email})`.execute(db);
    }
    const accounts = await findPersonaAccounts(db);
    expect(accounts.map((account) => account.persona).sort()).toEqual(['claims-handler', 'finance', 'head-of-claims', 'supplier-coordinator']);

    const test = await seedFromFixtures(db, 'TEST', accounts);
    const demo = await seedFromFixtures(db, 'DEMO', accounts);
    expect([test.rows.claim, demo.rows.claim]).toEqual([metrics.TEST.claims, metrics.DEMO.claims_count]);
    expect([test.rows.invoice, demo.rows.invoice]).toEqual([metrics.TEST.premium_invoices, metrics.DEMO.invoice_count]);
    expect([test.quarantined, demo.quarantined, test.memberships]).toEqual([[], [], 4]);

    const counts = async () => {
      const result: Record<string, number> = {};
      for (const table of Object.values(ENTITY_TABLES)) {
        const rows = await sql<{ tenant_id: string; n: string }>`select tenant_id, count(*)::text as n from ${sql.table(table)} group by tenant_id`.execute(db);
        for (const row of rows.rows) {
          result[`${row.tenant_id}.${table}`] = Number(row.n);
        }
      }
      return result;
    };
    const first = await counts();
    for (const [report, tenant] of [[test, 'TEST'], [demo, 'DEMO']] as const) {
      for (const name of ENTITY_NAMES.filter((entity) => report.rows[entity] > 0)) {
        expect(first[`${tenant}.${ENTITY_TABLES[name]}`], `${tenant} ${name}`).toBe(report.rows[name]);
      }
    }

    const money = await sql<{ issued: string; allocated: string; paid: string; reserve: string }>`
      select (select sum(issued_amount) from invoices where tenant_id = 'TEST')::text as issued,
             (select sum(allocated_amount) from payment_allocations where tenant_id = 'TEST')::text as allocated,
             (select sum(paid_amount) from claim_payments where tenant_id = 'TEST' and status = 'POSTED')::text as paid,
             (select sum(current_outstanding_reserve) from claims where tenant_id = 'TEST' and status = 'OPEN')::text as reserve`.execute(db);
    expect(money.rows[0]).toEqual({
      issued: `${metrics.TEST.issued_BWP}.00`,
      allocated: `${metrics.TEST.allocated_BWP}.00`,
      paid: `${metrics.TEST.paid_to_date_BWP}.00`,
      reserve: `${metrics.TEST.outstanding_reserve_BWP}.00`,
    });

    const ruleConfigs = await db.selectFrom('rule_configs').select(['tenant_id', 'data_set', 'config', 'version']).orderBy('tenant_id').execute();
    expect(ruleConfigs.map((row) => [row.tenant_id, row.data_set, row.version])).toEqual([['DEMO', 'DEMO', 1], ['TEST', 'TEST', 1]]);
    for (const row of ruleConfigs) {
      expect(row.config).toEqual(readFixtureJson('proposed_rule_config.json'));
    }

    const badRow = 'TEST,CLM-999,POL-001,2026-10-01,2026-10-01,Assessment,OPEN,USR-CLM,SUP-02,not-an-amount,BWP,\n';
    const withBadRow = withEdit(readFixtureFiles('test'), 'claims.csv', (text) => `${text.trimEnd()}\n${badRow}`);
    const flagged = await seedDataSet(db, 'TEST', withBadRow, readFixtureJson('proposed_rule_config.json'), accounts);
    expect(flagged.quarantined).toHaveLength(1);
    expect(flagged.quarantined[0]).toMatchObject({ file: 'claims.csv', record_id: 'CLM-999', field: 'current_outstanding_reserve' });
    expect(flagged.rows.claim).toBe(6);
    const stored = await db.selectFrom('data_issues').select(['kind', 'source_row', 'record_id']).where('tenant_id', '=', 'TEST').orderBy('issue_no').execute();
    expect(stored).toHaveLength(flagged.quarantined.length + flagged.warnings.length);
    expect(stored[0]).toMatchObject({ kind: 'quarantined', record_id: 'CLM-999' });
    expect(await db.selectFrom('claims').select('claim_id').where('claim_id', '=', 'CLM-999').execute()).toEqual([]);

    await seedFromFixtures(db, 'TEST', accounts);
    expect(await counts()).toEqual(first);
  });
});
