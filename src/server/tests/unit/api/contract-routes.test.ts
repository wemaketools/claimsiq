/**
 * The API is the contract list served: every endpoint of `src/contracts/endpoints.ts` has exactly one route, behind the
 * session (an anonymous call is a 401, never a 404) except the public ones, which answer without one, and nothing else is
 * served but the health check. Needs no database: the session middleware refuses first.
 */
import { describe, expect, it } from 'vitest';

import { endpoints, publicEndpoints } from '../../../../contracts/index.js';
import { loadConfig } from '../../../lib/config/index.js';
import { createDb } from '../../../lib/db/index.js';
import { API_BASE_PATH, HEALTH_PATH, buildApp } from '../../../lib/router/app.js';

const config = loadConfig({
  SUPABASE_URL: 'http://127.0.0.1:54421',
  SUPABASE_ANON_KEY: 'anon-key-value',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-value',
});

describe('the API routes', () => {
  it('serve every contract endpoint once, behind the session, and nothing else but the health check', async () => {
    const db = createDb('postgres://nobody@127.0.0.1:1/none', 1);
    const app = buildApp({ config, db, verify: () => Promise.resolve({ ok: false, reason: 'missing_token', detail: 'none' }) });
    const routes = app.routes.filter((route) => route.method !== 'ALL');

    const served = routes.map((route) => `${route.method} ${route.path}`);
    const contracted = [...Object.values(endpoints), ...Object.values(publicEndpoints)].map((endpoint) => `${endpoint.method} ${endpoint.path}`);
    expect(served.filter((route) => route !== `GET ${HEALTH_PATH}`).sort()).toEqual(contracted.sort());

    for (const endpoint of Object.values(endpoints)) {
      const path = endpoint.path.replace(/:[A-Za-z]+/g, 'x');
      const response = await app.request(path, { method: endpoint.method });
      expect(response.status, endpoint.id).toBe(401);
      expect(response.headers.get('content-type'), endpoint.id).toBe('application/problem+json');
      expect(response.headers.get('www-authenticate'), endpoint.id).toBe('Bearer');
    }

    for (const endpoint of Object.values(publicEndpoints)) {
      const response = await app.request(endpoint.path, { method: endpoint.method, headers: { 'Content-Type': 'application/json' }, body: '{}' });
      expect(response.status, endpoint.id).toBe(422);
    }

    expect((await app.request(HEALTH_PATH)).status).toBe(200);
    expect((await app.request(`${API_BASE_PATH}/nothing-here`)).status).toBe(401);
    await db.destroy();
  });
});
