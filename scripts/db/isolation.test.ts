/**
 * Tenant isolation against a scratch database seeded with TEST and DEMO (skipped without the local stack). One step
 * at the end of the second test reads the stack's own database instead, through Supabase's REST API.
 */
import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getConfig } from '../../src/server/lib/config/index.js';
import { toTenantId, withTenant } from '../../src/server/lib/db/index.js';
import { TENANT_TABLES } from '../../src/server/lib/db/generated/schema.js';
import { resolveTenantAccess } from '../../src/server/lib/tenancy/index.js';
import { DEMO_ACCOUNTS } from '../../src/contracts/demoAccounts.js';
import { createScratchDatabase, reachableDatabaseUrl } from './scratchDatabase.js';
import type { ScratchDatabase } from './scratchDatabase.js';
import { findPersonaAccounts, seedFromFixtures } from './seed.js';

const serverUrl = await reachableDatabaseUrl();

/** Runs `work` in a transaction as the application role, with the tenant setting `tenant` (or none), and rolls back. */
async function asApp<R>(client: pg.Client, tenant: string | null, work: () => Promise<R>): Promise<R> {
  await client.query('begin');
  try {
    await client.query('set local role claimsiq_app');
    if (tenant !== null) {
      await client.query("select set_config('app.tenant_id', $1, true)", [tenant]);
    }
    return await work();
  } finally {
    await client.query('rollback');
  }
}

async function failureCode(client: pg.Client, tenant: string, statement: string): Promise<string | undefined> {
  return await asApp(client, tenant, async () => {
    try {
      await client.query(statement);
      return undefined;
    } catch (error) {
      return (error as { code?: string }).code;
    }
  });
}

describe.skipIf(serverUrl === null)('tenant isolation', () => {
  let scratch: ScratchDatabase;
  let headOfClaims = '';

  beforeAll(async () => {
    scratch = await createScratchDatabase(serverUrl ?? '');
    for (const account of DEMO_ACCOUNTS) {
      await sql`insert into auth.users (email) values (${account.email})`.execute(scratch.db);
    }
    const accounts = await findPersonaAccounts(scratch.db);
    headOfClaims = accounts.find((account) => account.persona === 'head-of-claims')?.authUserId ?? '';
    await seedFromFixtures(scratch.db, 'TEST', accounts);
    await seedFromFixtures(scratch.db, 'DEMO', accounts);
    // The fixtures hold no tasks: give DEMO one, with its audit entry, so the checks below have rows to keep out.
    await scratch.db.insertInto('tasks').values({ tenant_id: 'DEMO', task_id: 'TASK-0001', module: 'CLAIMS', subject_type: 'CLAIM', subject_id: 'DCLM-002', priority: 'LOW', status: 'OPEN', updated_at: '2026-10-21T08:00:00+02:00' }).execute();
    await scratch.db.insertInto('task_audit_entries').values({ tenant_id: 'DEMO', task_id: 'TASK-0001', at: '2026-10-21T08:00:00+02:00', actor: 'finance', action: 'CREATED' }).execute();
  });
  afterAll(async () => {
    await scratch.drop();
  });

  it('keeps a TEST session away from every DEMO row, to read or to write, and a session with no tenant away from all rows', async () => {
    await scratch.withClient(async (client) => {
      const demoTaskRows = await client.query<{ n: string }>("select (select count(*) from tasks where tenant_id = 'DEMO') + (select count(*) from task_audit_entries where tenant_id = 'DEMO') as n");
      expect(Number(demoTaskRows.rows[0]?.n)).toBe(2);
      for (const table of TENANT_TABLES) {
        const owner = await client.query<{ tenant_id: string; n: string }>(`select tenant_id, count(*)::text as n from ${table} group by tenant_id`);
        const test = Number(owner.rows.find((row) => row.tenant_id === 'TEST')?.n ?? 0);
        const seen = await asApp(client, 'TEST', () => client.query<{ tenant_id: string; n: string }>(`select tenant_id, count(*)::text as n from ${table} group by tenant_id`));
        expect(seen.rows.map((row) => row.tenant_id).filter((id) => id !== 'TEST'), table).toEqual([]);
        expect(Number(seen.rows[0]?.n ?? 0), table).toBe(test);
        const unscoped = await asApp(client, null, () => client.query(`select 1 from ${table}`));
        expect(unscoped.rowCount, table).toBe(0);
      }
      const demoClaims = await client.query<{ n: string }>("select count(*)::text as n from claims where tenant_id = 'DEMO'");
      expect(demoClaims.rows[0]?.n).toBe('30');

      expect(await failureCode(client, 'TEST', "insert into clients (tenant_id, client_id, name, segment, region, is_corporate) values ('DEMO', 'CLI-X', 'x', 'x', 'x', false)")).toBe('42501');
      expect(await asApp(client, 'TEST', async () => (await client.query("update claims set stage = 'Closed' where tenant_id = 'DEMO'")).rowCount)).toBe(0);
      expect(await asApp(client, 'TEST', async () => (await client.query("delete from claims where tenant_id = 'DEMO'")).rowCount)).toBe(0);

      const demoOnly = await client.query<{ policy_id: string }>("select policy_id from policies d where tenant_id = 'DEMO' and not exists (select 1 from policies t where t.tenant_id = 'TEST' and t.policy_id = d.policy_id) limit 1");
      const foreign = demoOnly.rows[0]?.policy_id ?? '';
      await client.query('begin');
      const crossTenantFk = await client
        .query(`insert into claims values ('TEST', 'CLM-X', '${foreign}', null, null, 'New', 'OPEN', 'USR-CLM', null, 0, 'BWP', null)`)
        .then(() => undefined, (error: { code?: string }) => error.code);
      await client.query('rollback');
      expect(crossTenantFk).toBe('23503');
    });

    const test = toTenantId('TEST');
    const viaHelper = await withTenant(scratch.db, test, async (scope) => ({
      scoped: await scope.selectFrom('claims').select('tenant_id').execute(),
      rlsOnly: await scope.db.selectFrom('claims').select('tenant_id').execute(),
    }));
    expect(viaHelper.scoped).toHaveLength(6);
    expect(viaHelper.rlsOnly).toHaveLength(6);
    expect([...viaHelper.scoped, ...viaHelper.rlsOnly].every((row) => row.tenant_id === 'TEST')).toBe(true);
  });

  it('lets a user enter only the tenants they are a member of, and lets the application add tasks and audit entries to its own tenant but never change or remove an audit entry or delete a task, and never use another tenant\'s task counter, and the stack\'s REST API refuses the anonymous key', async () => {
    expect(await resolveTenantAccess(scratch.db, headOfClaims, 'TEST')).toMatchObject({ ok: true, tenantId: 'TEST', persona: 'head-of-claims' });
    const strangers = [
      resolveTenantAccess(scratch.db, randomUUID(), 'TEST'),
      resolveTenantAccess(scratch.db, headOfClaims, 'NOPE'),
      resolveTenantAccess(scratch.db, headOfClaims, "TEST'; drop table claims; --"),
    ];
    for (const access of await Promise.all(strangers)) {
      expect(access).toEqual({ ok: false, reason: 'not_a_member' });
    }

    const test = toTenantId('TEST');
    const ids = await withTenant(scratch.db, test, async (scope) => {
      const first = await sql<{ id: string }>`select next_task_id(${scope.tenantId}) as id`.execute(scope.db);
      const second = await sql<{ id: string }>`select next_task_id(${scope.tenantId}) as id`.execute(scope.db);
      await scope.insertInto('tasks', { task_id: 'TASK-0001', module: 'CLAIMS', subject_type: 'CLAIM', subject_id: 'CLM-101', priority: 'HIGH', status: 'OPEN', updated_at: '2026-10-21T08:00:00+02:00' }).execute();
      await scope.insertInto('task_audit_entries', { task_id: 'TASK-0001', at: '2026-10-21T08:00:00+02:00', actor: 'head-of-claims', action: 'CREATED' }).execute();
      return [first.rows[0]?.id, second.rows[0]?.id];
    });
    expect(ids).toEqual(['TASK-0001', 'TASK-0002']);

    await scratch.withClient(async (client) => {
      expect(await failureCode(client, 'TEST', "update task_audit_entries set note = 'edited'")).toBe('42501');
      expect(await failureCode(client, 'TEST', 'delete from task_audit_entries')).toBe('42501');
      expect(await failureCode(client, 'TEST', 'delete from tasks')).toBe('42501');
      const trail = await client.query<{ n: string }>("select count(*)::text as n from task_audit_entries where tenant_id = 'TEST'");
      expect(trail.rows[0]?.n).toBe('1');
      expect(await failureCode(client, 'TEST', "select next_task_id('DEMO')")).toBe('42501');
    });

    // PostgREST serves the stack's own database, not the scratch one: this checks what `db:migrate` / `db:reset` left there.
    const api = getConfig().supabase;
    const response = await fetch(`${api.url}/rest/v1/claims?select=claim_id`, { headers: { apikey: api.anonKey, authorization: `Bearer ${api.anonKey}` } });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: '42501', message: 'permission denied for table claims' });
  });
});
