/**
 * The API against the local stack: real Supabase tokens, a scratch database seeded with TEST and DEMO (skipped without
 * the stack, as the other database tests). One walk: refused callers, the TEST figures from the database equal
 * `expected_metrics.json`, a task is created, assigned and moved on with its audit trail, the rule config is saved,
 * refused and restored with its audit, nothing leaks into DEMO, and Reset restores the fixture (and is refused outside local and dev).
 */
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TaskRecord } from '../../../../contracts/index.js';
import { createScratchDatabase, reachableDatabaseUrl } from '../../../../../scripts/db/scratchDatabase.js';
import type { ScratchDatabase } from '../../../../../scripts/db/scratchDatabase.js';
import { findPersonaAccounts, seedFromFixtures } from '../../../../../scripts/db/seed.js';
import { verifyAccessToken } from '../../../lib/auth/verify.js';
import { getConfig } from '../../../lib/config/index.js';
import { buildApp } from '../../../lib/router/app.js';
import { readFixtureJson } from '../../../lib/seed/fixtureFiles.js';
import { passwordGrant, stackIsReachable } from '../../helpers/localStack.js';

const HANDLER = 'claims.handler@claimsiq.local';
const FINANCE = 'finance@claimsiq.local';

async function stackIsUp(): Promise<boolean> {
  return (await reachableDatabaseUrl()) !== null && (await stackIsReachable());
}

const serverUrl = await reachableDatabaseUrl();
const stackUp = await stackIsUp();

/** A JSON answer; `items` is there on the lists. */
type Body = { items: unknown[] } & Record<string, unknown>;

interface Metrics {
  TEST: { claims: number; open_claims: number; paid_to_date_BWP: number; outstanding_reserve_BWP: number; gross_incurred_BWP: number };
}

describe.skipIf(!stackUp)('the API against the local stack', () => {
  let scratch: ScratchDatabase;
  let handlerToken = '';
  let financeToken = '';

  beforeAll(async () => {
    scratch = await createScratchDatabase(serverUrl ?? '');
    handlerToken = await passwordGrant(HANDLER);
    financeToken = await passwordGrant(FINANCE);
    // The scratch database stands in for Supabase Auth's users table: give it the real accounts' ids.
    for (const [email, token] of [[HANDLER, handlerToken], [FINANCE, financeToken], ['head.of.claims@claimsiq.local', await passwordGrant('head.of.claims@claimsiq.local')], ['supplier.coordinator@claimsiq.local', await passwordGrant('supplier.coordinator@claimsiq.local')]] as const) {
      const verified = await verifyAccessToken(token);
      if (!verified.ok) throw new Error(verified.detail);
      await sql`insert into auth.users (id, email) values (${verified.token.authUserId}, ${email})`.execute(scratch.db);
    }
    const accounts = await findPersonaAccounts(scratch.db);
    await seedFromFixtures(scratch.db, 'TEST', accounts);
    await seedFromFixtures(scratch.db, 'DEMO', accounts);
    // Finance is a member of TEST only here.
    await sql`delete from tenant_memberships where tenant_id = 'DEMO' and persona = 'finance'`.execute(scratch.db);
  });

  afterAll(async () => {
    await scratch.drop();
  });

  it('refuses callers without a session or tenant, serves TEST figures equal to the spec from the database, keeps a task and its audit trail, and restores the fixture on Reset', async () => {
    const config = getConfig();
    const app = buildApp({ config, db: scratch.db, verify: verifyAccessToken });
    const request = async (path: string, options: { token?: string; tenant?: string; persona?: string; method?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
      const headers: Record<string, string> = { ...options.headers };
      if (options.token !== undefined) headers.Authorization = `Bearer ${options.token}`;
      if (options.tenant !== undefined) headers['X-Tenant-Id'] = options.tenant;
      if (options.persona !== undefined) headers['X-Persona'] = options.persona;
      if (options.body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await app.request(path, {
        method: options.method ?? 'GET',
        headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
      return { status: response.status, json: (await response.json()) as Body };
    };
    const as = (token: string, tenant: string, persona = 'claims-handler') => ({ token, tenant, persona });

    // 401 and 403: no session, a forged token, no tenant, an unknown tenant, a tenant the account does not belong to.
    expect((await request('/api/v1/claims', { tenant: 'TEST' })).status).toBe(401);
    expect((await request('/api/v1/claims', { token: 'not.a.token', tenant: 'TEST' })).status).toBe(401);
    expect((await request('/api/v1/claims', { token: handlerToken })).status).toBe(400);
    expect((await request('/api/v1/claims', as(handlerToken, 'NOPE'))).status).toBe(403);
    expect((await request('/api/v1/claims', as(financeToken, 'DEMO'))).status).toBe(403);
    expect((await request('/api/v1/claims', as(financeToken, 'TEST'))).status).toBe(200);

    // The TEST figures from the database equal the spec's expected metrics.
    const metrics = readFixtureJson('expected_metrics.json') as Metrics;
    const facts = await request('/api/v1/claim-facts', as(handlerToken, 'TEST'));
    expect(facts.status).toBe(200);
    expect(facts.json.summary).toMatchObject({
      claims: metrics.TEST.claims,
      open: metrics.TEST.open_claims,
      totals: { paid: `${metrics.TEST.paid_to_date_BWP}.00`, reserve: `${metrics.TEST.outstanding_reserve_BWP}.00`, incurred: `${metrics.TEST.gross_incurred_BWP}.00` },
    });

    // A task: created (twice with one key makes one), assigned, moved on, with its audit trail and the signed-in account.
    const key = { 'Idempotency-Key': 'flow-test-key-1' };
    const draft = { subject_type: 'CLAIM', subject_id: 'CLM-101', due_at: '2026-10-01', priority: 'HIGH', note: 'Chase the supplier' };
    const created = await request('/api/v1/tasks', { ...as(handlerToken, 'TEST'), method: 'POST', body: draft, headers: key });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ task_id: 'TASK-0001', status: 'OPEN', assigned_to: null, audit: [{ action: 'CREATED', actor: 'claims-handler', to: 'OPEN' }] });
    const again = await request('/api/v1/tasks', { ...as(handlerToken, 'TEST'), method: 'POST', body: draft, headers: key });
    expect(again.json.task_id).toBe('TASK-0001');
    expect(await request('/api/v1/tasks', { ...as(handlerToken, 'TEST'), method: 'POST', body: { ...draft, subject_id: 'CLM-999' } })).toMatchObject({ status: 422 });
    expect(await request('/api/v1/tasks', { ...as(handlerToken, 'TEST'), method: 'POST', body: { ...draft, assigned_to: 'USR-NOBODY' } })).toMatchObject({ status: 422 });
    expect((await request('/api/v1/tasks', { token: handlerToken, tenant: 'TEST', method: 'POST', body: draft })).status).toBe(400);

    const assigned = await request('/api/v1/tasks/TASK-0001/assign', { ...as(handlerToken, 'TEST', 'head-of-claims'), method: 'POST', body: { assigned_to: 'USR-CLM' } });
    expect(assigned.json).toMatchObject({ assigned_to: 'USR-CLM' });
    const started = await request('/api/v1/tasks/TASK-0001/status', { ...as(handlerToken, 'TEST'), method: 'POST', body: { status: 'IN_PROGRESS', note: 'Called them' } });
    expect(started.status).toBe(200);
    const done = await request('/api/v1/tasks/TASK-0001/status', { ...as(handlerToken, 'TEST'), method: 'POST', body: { status: 'DONE' } });
    expect(done.status).toBe(200);
    const refused = await request('/api/v1/tasks/TASK-0001/status', { ...as(handlerToken, 'TEST'), method: 'POST', body: { status: 'IN_PROGRESS' } });
    expect(refused).toMatchObject({ status: 422, json: { errors: [{ field: 'status' }] } });
    expect((await request('/api/v1/tasks/TASK-0042/status', { ...as(handlerToken, 'TEST'), method: 'POST', body: { status: 'DONE' } })).status).toBe(404);

    const listed = await request('/api/v1/tasks', as(financeToken, 'TEST'));
    expect(listed.json.items).toHaveLength(1);
    const task = TaskRecord.parse(listed.json.items[0]);
    expect(task).toMatchObject({ task_id: 'TASK-0001', status: 'DONE', assigned_to: 'USR-CLM' });
    expect(task.audit.map((entry) => [entry.action, entry.actor, entry.from, entry.to, entry.note])).toEqual([
      ['CREATED', 'claims-handler', null, 'OPEN', 'Chase the supplier'],
      ['ASSIGNED', 'head-of-claims', null, 'USR-CLM', null],
      ['STATUS_CHANGED', 'claims-handler', 'OPEN', 'IN_PROGRESS', 'Called them'],
      ['STATUS_CHANGED', 'claims-handler', 'IN_PROGRESS', 'DONE', null],
    ]);
    const signedIn = await verifyAccessToken(handlerToken);
    const accountsOfEntries = await sql<{ actor_user_id: string }>`select actor_user_id::text from task_audit_entries where tenant_id = 'TEST' and task_id = 'TASK-0001' order by audit_id`.execute(scratch.db);
    expect(accountsOfEntries.rows).toHaveLength(4);
    expect(new Set(accountsOfEntries.rows.map((row) => row.actor_user_id))).toEqual(new Set([signedIn.ok ? signedIn.token.authUserId : 'not signed in']));

    // Another tenant never sees it.
    const demoTasks = await request('/api/v1/tasks', as(handlerToken, 'DEMO'));
    expect(demoTasks.json.items).toEqual([]);
    const demoTask = await request('/api/v1/tasks', { ...as(handlerToken, 'DEMO'), method: 'POST', body: { ...draft, subject_id: 'DCLM-002', assigned_to: 'USR-CLM' } });
    expect(demoTask.status).toBe(201);
    // A task made with an owner logs the assignment too, as the later ones do.
    expect((demoTask.json.audit as { action: string; to: string }[]).map((entry) => [entry.action, entry.to])).toEqual([['CREATED', 'OPEN'], ['ASSIGNED', 'USR-CLM']]);

    // Validation of the inputs by the contracts.
    expect((await request('/api/v1/tasks?status=NOPE', as(handlerToken, 'TEST'))).status).toBe(400);
    expect((await request('/api/v1/claims', { ...as(handlerToken, 'TEST'), headers: { 'X-As-Of': '2026-13-45' } })).status).toBe(400);
    expect((await request('/api/v1/claims/CLM-999', as(handlerToken, 'TEST'))).status).toBe(404);

    // The rule config: a persona that may not edit is refused by the server, a stale version is a 409, a save is audited
    // with the signed-in account and applies to the engine at once, and another tenant keeps the spec's config.
    const rules = await request('/api/v1/rule-config', as(handlerToken, 'TEST'));
    expect(rules.json).toMatchObject({ version: 1, saved_at: null, saved_by: null, audit: [] });
    const editable = { ...(rules.json.config as { claims: Record<string, unknown> }).claims };
    delete editable.business_days;
    delete editable.holidays_excluded;
    const raised = { version: 1, claims: { ...editable, high_value_incurred_BWP: 40000 } };
    const highValue = async (tenant: string) => ((await request('/api/v1/claim-facts', as(handlerToken, tenant))).json.items as { claim_id: string; high_value: boolean }[]).filter((fact) => fact.high_value).map((fact) => fact.claim_id);
    expect(await highValue('TEST')).toEqual(['CLM-106']);
    expect((await request('/api/v1/rule-config', { ...as(handlerToken, 'TEST', 'claims-handler'), method: 'POST', body: raised })).status).toBe(403);
    expect((await request('/api/v1/rule-config/restore', { ...as(handlerToken, 'TEST', 'supplier-coordinator'), method: 'POST', body: { version: 1 } })).status).toBe(403);
    expect((await request('/api/v1/rule-config', { token: handlerToken, tenant: 'TEST', method: 'POST', body: raised })).status).toBe(400);
    expect((await request('/api/v1/rule-config', { ...as(handlerToken, 'TEST', 'finance'), method: 'POST', body: { ...raised, version: 5 } })).status).toBe(409);
    expect((await request('/api/v1/rule-config', { ...as(handlerToken, 'TEST', 'finance'), method: 'POST', body: { version: 1, claims: { ...editable, high_value_incurred_BWP: -5 } } })).status).toBe(422);
    const savedRules = await request('/api/v1/rule-config', { ...as(handlerToken, 'TEST', 'finance'), method: 'POST', body: raised });
    expect(savedRules).toMatchObject({ status: 200, json: { version: 2, saved_by: 'finance', audit: [{ version: 2, actor: 'finance', action: 'CHANGED', field: 'high_value_incurred_BWP', from: '25000', to: '40000' }] } });
    expect(await highValue('TEST')).toEqual([]);
    expect(await highValue('DEMO')).not.toEqual([]);
    expect((await request('/api/v1/rule-config', as(handlerToken, 'DEMO'))).json).toMatchObject({ version: 1, audit: [] });
    const ruleAudit = await sql<{ actor_user_id: string }>`select actor_user_id::text from rule_config_audit_entries where tenant_id = 'TEST'`.execute(scratch.db);
    expect(ruleAudit.rows.map((row) => row.actor_user_id)).toEqual([signedIn.ok ? signedIn.token.authUserId : 'not signed in']);
    const restoredRules = await request('/api/v1/rule-config/restore', { ...as(handlerToken, 'TEST', 'head-of-claims'), method: 'POST', body: { version: 2 } });
    expect(restoredRules.json).toMatchObject({ version: 3, audit: [{ action: 'CHANGED' }, { version: 3, action: 'RESTORED', field: 'high_value_incurred_BWP', from: '40000', to: '25000' }] });
    expect(await highValue('TEST')).toEqual(['CLM-106']);
    await request('/api/v1/rule-config', { ...as(handlerToken, 'TEST', 'finance'), method: 'POST', body: { ...raised, version: 3 } });

    // Reset is refused outside local and dev, and leaves the data alone; in local it restores TEST and only TEST.
    const production = buildApp({ config: { ...config, appEnv: 'production' }, db: scratch.db, verify: verifyAccessToken });
    const blocked = await production.request('/api/v1/demo/reset', { method: 'POST', headers: { Authorization: `Bearer ${handlerToken}`, 'X-Tenant-Id': 'TEST' } });
    expect(blocked.status).toBe(403);
    expect((await request('/api/v1/tasks', as(handlerToken, 'TEST'))).json.items).toHaveLength(1);
    expect((await request('/api/v1/rule-config', as(handlerToken, 'TEST'))).json).toMatchObject({ version: 4 });

    const reset = await request('/api/v1/demo/reset', { ...as(handlerToken, 'TEST'), method: 'POST' });
    expect(reset).toMatchObject({ status: 200, json: { tenant_id: 'TEST', reset: true } });
    expect((await request('/api/v1/tasks', as(handlerToken, 'TEST'))).json.items).toEqual([]);
    expect((await request('/api/v1/rule-config', as(handlerToken, 'TEST'))).json).toMatchObject({ version: 1, saved_at: null, audit: [] });
    expect(await highValue('TEST')).toEqual(['CLM-106']);
    expect((await request('/api/v1/tasks', as(handlerToken, 'DEMO'))).json.items).toHaveLength(1);
    expect((await request('/api/v1/claim-facts', as(handlerToken, 'TEST'))).json).toEqual(facts.json);
    const next = await request('/api/v1/tasks', { ...as(handlerToken, 'TEST'), method: 'POST', body: draft });
    expect(next.json.task_id).toBe('TASK-0001');
  });
});
