/**
 * The server and the mock API give the same answers (skipped without the local stack's database): the same fixtures,
 * one seeded into a scratch database behind the real Hono app and one parsed by the mock API, answer every read
 * endpoint alike for both tenants, at two as-of dates and with filters, with rejected rows in TEST (so the data issues
 * list has content), with every claim's what-if to each stage, legal or not, and keep alike through a task created,
 * assigned and moved on and through rule config saves, refused (403, 409, 422) and restored, with a fixed clock.
 */
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DATA_SET_IDS, endpoints } from '../../src/contracts/index.js';
import type { DataSetId } from '../../src/contracts/index.js';
import { createMockApi, memoryStore } from '../../src/mock-api/index.js';
import { withEdit } from '../../src/read-model/test-support/fixtureFiles.js';
import { readFixtureFiles, readFixtureJson } from '../../src/server/lib/seed/fixtureFiles.js';
import { loadConfig } from '../../src/server/lib/config/index.js';
import { buildApp } from '../../src/server/lib/router/app.js';
import { DEMO_ACCOUNTS } from '../../src/contracts/demoAccounts.js';
import { createScratchDatabase, reachableDatabaseUrl } from './scratchDatabase.js';
import type { ScratchDatabase } from './scratchDatabase.js';
import { findPersonaAccounts, seedDataSet } from './seed.js';

const serverUrl = await reachableDatabaseUrl();
const NOW = new Date('2026-10-21T09:30:00Z');

const config = loadConfig({
  SUPABASE_URL: 'http://127.0.0.1:54421',
  SUPABASE_ANON_KEY: 'anon-key-value',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-value',
});

const BAD_CLAIM = 'TEST,CLM-999,POL-001,2026-10-01,2026-10-01,Assessment,OPEN,USR-CLM,SUP-02,not-an-amount,BWP,\n';
const ruleConfig = readFixtureJson('proposed_rule_config.json');
const fixtures: Record<DataSetId, Record<string, string>> = {
  TEST: withEdit(readFixtureFiles('test'), 'claims.csv', (text) => `${text.trimEnd()}\n${BAD_CLAIM}`),
  DEMO: readFixtureFiles('demo'),
};

describe.skipIf(serverUrl === null)('the API and the mock API', () => {
  let scratch: ScratchDatabase;

  beforeAll(async () => {
    scratch = await createScratchDatabase(serverUrl ?? '');
    for (const account of DEMO_ACCOUNTS) {
      await sql`insert into auth.users (email) values (${account.email})`.execute(scratch.db);
    }
    const accounts = await findPersonaAccounts(scratch.db);
    for (const dataSet of DATA_SET_IDS) {
      await seedDataSet(scratch.db, dataSet, fixtures[dataSet], ruleConfig, accounts);
    }
  });
  afterAll(async () => {
    await scratch.drop();
  });

  it('answer every read endpoint alike for both tenants, and stay alike through the task commands', async () => {
    const userId = (await findPersonaAccounts(scratch.db))[0]?.authUserId ?? '';
    const app = buildApp({
      config,
      db: scratch.db,
      now: () => NOW,
      verify: () => Promise.resolve({ ok: true, token: { authUserId: userId, email: null, sessionId: null, expiresAt: 0, algorithm: 'ES256', keyId: 'test' } }),
    });
    const mock = createMockApi({ fixtures, storage: memoryStore(), ruleConfig, now: () => NOW });

    const ask = async (via: 'server' | 'mock', tenant: string, path: string, init: { method?: string; body?: unknown; asOf?: string; persona?: string } = {}) => {
      const headers: Record<string, string> = { 'X-Tenant-Id': tenant, 'X-As-Of': init.asOf ?? '2026-10-21', 'X-Persona': init.persona ?? 'head-of-claims', Authorization: 'Bearer test' };
      if (init.body !== undefined) headers['Content-Type'] = 'application/json';
      const request = { method: init.method ?? 'GET', headers, ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }) };
      const response = via === 'server' ? await app.request(path, request) : await mock.fetch(path, request);
      // A problem document carries a fresh correlation id each time.
      const { correlationId: _id, ...body } = (await response.json()) as Record<string, unknown>;
      return { status: response.status, body };
    };
    const same = async (tenant: string, path: string, init: { method?: string; body?: unknown; asOf?: string; persona?: string } = {}) => {
      const [server, mocked] = [await ask('server', tenant, path, init), await ask('mock', tenant, path, init)];
      expect(server, `${tenant} ${init.method ?? 'GET'} ${path} ${init.asOf ?? ''}`).toEqual(mocked);
      return server;
    };

    const reads = Object.values(endpoints).filter((endpoint) => endpoint.method === 'GET' && !endpoint.path.includes(':'));
    for (const tenant of DATA_SET_IDS) {
      for (const asOf of ['2026-10-21', '2026-10-10']) {
        for (const endpoint of reads) {
          await same(tenant, endpoint.path, { asOf });
        }
        await same(tenant, '/api/v1/claim-facts?period=7d&broker_id=BRK-01', { asOf });
        await same(tenant, '/api/v1/claim-facts?handler_id=USR-CLM', { asOf });
        await same(tenant, '/api/v1/supplier-insights?product_id=PRD-01', { asOf });
        await same(tenant, '/api/v1/invoices?policy_id=POL-001', { asOf });
      }
      const claims = (await same(tenant, endpoints.claimsList.path)).body as unknown as { items: { claim_id: string }[] };
      for (const claim of claims.items) {
        await same(tenant, `/api/v1/claims/${claim.claim_id}`);
      }
      await same(tenant, '/api/v1/claims/CLM-NOPE');
      for (const claim of claims.items) {
        const options = (await same(tenant, `/api/v1/claims/${claim.claim_id}/what-if`)).body as unknown as { next_stages: string[] };
        for (const stage of ['New', ...options.next_stages]) {
          await same(tenant, `/api/v1/claims/${claim.claim_id}/what-if?to_stage=${stage}`);
        }
      }
      await same(tenant, '/api/v1/claims/CLM-NOPE/what-if');
      await same(tenant, '/api/v1/claims/CLM-101/what-if?to_stage=Nowhere');
      await same(tenant, '/api/v1/claims/CLM-101/what-if?to_stage=Negotiation', { asOf: '2026-10-10' });
    }
    const issues = (await same('TEST', endpoints.dataIssues.path)).body as unknown as { quarantined_rows: number };
    expect(issues.quarantined_rows).toBeGreaterThan(0);

    for (const tenant of DATA_SET_IDS) {
      const subject = tenant === 'TEST' ? 'CLM-101' : 'DCLM-002';
      const created = (await same(tenant, endpoints.tasksCreate.path, {
        method: 'POST',
        body: { subject_type: 'CLAIM', subject_id: subject, assigned_to: 'USR-FIN', priority: 'HIGH', due_at: '2026-10-01', note: 'Chase the supplier' },
      })).body as unknown as { task_id: string };
      await same(tenant, `/api/v1/tasks/${created.task_id}/assign`, { method: 'POST', body: { assigned_to: 'USR-CLM' } });
      await same(tenant, `/api/v1/tasks/${created.task_id}/status`, { method: 'POST', body: { status: 'IN_PROGRESS', note: 'Called them' } });
      await same(tenant, `/api/v1/tasks/${created.task_id}/status`, { method: 'POST', body: { status: 'OPEN' } });
      await same(tenant, `/api/v1/tasks/${created.task_id}/status`, { method: 'POST', body: { status: 'DONE' } });
      await same(tenant, `/api/v1/tasks/${created.task_id}/status`, { method: 'POST', body: { status: 'IN_PROGRESS' } });
      await same(tenant, `/api/v1/tasks/${created.task_id}/assign`, { method: 'POST', body: { assigned_to: 'USR-NOBODY' } });
      await same(tenant, endpoints.tasksCreate.path, { method: 'POST', body: { subject_type: 'POLICY', subject_id: 'POL-NOPE' } });
      await same(tenant, '/api/v1/tasks?status=DONE');
      await same(tenant, endpoints.tasksList.path);
      await same(tenant, endpoints.suppliersInsights.path);
    }

    for (const tenant of DATA_SET_IDS) {
      const { config } = (await same(tenant, endpoints.ruleConfigGet.path)).body as unknown as { config: { claims: Record<string, unknown> } };
      const { business_days: _days, holidays_excluded: _holidays, ...editable } = config.claims;
      const save = { method: 'POST', body: { version: 1, claims: { ...editable, high_value_incurred_BWP: 40000, stage_sla_business_days: { New: 2, Assessment: 3 }, age_bucket_upper_days: [10, 30] } } };
      await same(tenant, endpoints.ruleConfigSave.path, { ...save, persona: 'claims-handler' });
      await same(tenant, endpoints.ruleConfigSave.path, { ...save, persona: 'supplier-coordinator' });
      await same(tenant, endpoints.ruleConfigSave.path, { ...save, body: { ...save.body, version: 9 } });
      await same(tenant, endpoints.ruleConfigSave.path, { ...save, body: { version: 1, claims: { ...editable, supplier_min_sample: 0 } } });
      await same(tenant, endpoints.ruleConfigSave.path, { ...save, body: { version: 1 } });
      await same(tenant, endpoints.ruleConfigSave.path, save);
      await same(tenant, endpoints.ruleConfigSave.path, { ...save, body: { version: 2, claims: { ...save.body.claims, supplier_min_sample: 3 } }, persona: 'finance' });
      await same(tenant, endpoints.ruleConfigGet.path);
      await same(tenant, endpoints.claimsFacts.path);
      await same(tenant, endpoints.suppliersInsights.path);
      await same(tenant, endpoints.ruleConfigRestore.path, { method: 'POST', body: { version: 3 }, persona: 'claims-handler' });
      await same(tenant, endpoints.ruleConfigRestore.path, { method: 'POST', body: { version: 2 } });
      await same(tenant, endpoints.ruleConfigRestore.path, { method: 'POST', body: { version: 3 } });
      await same(tenant, endpoints.ruleConfigRestore.path, { method: 'POST', body: { version: 4 } });
      await same(tenant, endpoints.ruleConfigGet.path);
      await same(tenant, endpoints.claimsFacts.path);
    }
  });
});
