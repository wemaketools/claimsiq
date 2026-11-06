/**
 * Demo sign-in over the real app with Supabase Auth stood in for (no stack, no database): only the list's e-mails are
 * signed in, with the environment's password; every other refusal is one and the same problem; a hosted environment
 * without a password says so; and the call needs no bearer token or tenant.
 */
import { describe, expect, it, vi } from 'vitest';

import { DEMO_SIGN_IN_NOT_CONFIGURED_CODE, DEMO_SIGN_IN_REFUSED_CODE, DemoSession } from '../../../../contracts/index.js';
import { LOCAL_DEMO_PASSWORD, resolveDemoPassword } from '../../../lib/config/demo-password.js';
import { ConfigurationError, loadConfig } from '../../../lib/config/index.js';
import { createDb } from '../../../lib/db/index.js';
import { buildApp } from '../../../lib/router/app.js';
import type { PasswordSignIn } from '../../../domains/demo-sign-in/handlers.js';

const BASE_ENV = {
  SUPABASE_URL: 'http://127.0.0.1:54421',
  SUPABASE_ANON_KEY: 'anon-key-value',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-value',
};
const SESSION = { access_token: 'access-token-value', refresh_token: 'refresh-token-value', expires_at: 1_900_000_000 };
const PATH = '/api/v1/auth/demo-sign-in';

function appFor(env: Record<string, string>, signIn: PasswordSignIn) {
  const config = loadConfig({ ...BASE_ENV, ...env });
  const db = createDb('postgres://nobody@127.0.0.1:1/none', 1);
  const app = buildApp({ config, db, verify: () => Promise.resolve({ ok: false, reason: 'missing_token', detail: 'none' }), passwordSignIn: signIn });
  return { app, db };
}

async function post(app: ReturnType<typeof appFor>['app'], body: unknown) {
  const response = await app.request(PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

describe('POST /api/v1/auth/demo-sign-in', () => {
  it('signs in a listed account with the environment password and refuses everything else with one problem, telling a missing password apart', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const signIn = vi.fn<PasswordSignIn>((_config, _email, password) => Promise.resolve(password === 'wrong-password-1' ? null : SESSION));

    // Local, no DEMO_SEED_PASSWORD: the committed local password; the e-mail is matched ignoring case and spaces.
    const local = appFor({}, signIn);
    const ok = await post(local.app, { email: '  Finance@ClaimsIQ.local ' });
    expect(ok.status).toBe(200);
    expect(DemoSession.parse(ok.json)).toEqual(SESSION);
    expect(signIn).toHaveBeenLastCalledWith(expect.anything(), 'finance@claimsiq.local', LOCAL_DEMO_PASSWORD);

    // A configured password wins over the local one.
    const configured = appFor({ DEMO_SEED_PASSWORD: 'configured-pass-1' }, signIn);
    await post(configured.app, { email: 'finance@claimsiq.local' });
    expect(signIn).toHaveBeenLastCalledWith(expect.anything(), 'finance@claimsiq.local', 'configured-pass-1');

    // Off the list and Auth saying no look the same (status, title, code), and Auth is not even asked about the first.
    signIn.mockClear();
    const unknown = await post(configured.app, { email: 'someone.else@example.com' });
    const wrongPassword = await post(appFor({ DEMO_SEED_PASSWORD: 'wrong-password-1' }, signIn).app, { email: 'finance@claimsiq.local' });
    expect(signIn).toHaveBeenCalledTimes(1);
    const refusal = { status: 403, title: 'Demo sign-in is not available for this account.', code: DEMO_SIGN_IN_REFUSED_CODE };
    for (const refused of [unknown, wrongPassword]) {
      expect(refused.status).toBe(refusal.status);
      expect(refused.json).toMatchObject(refusal);
      expect(JSON.stringify(refused.json)).not.toContain('wrong-password-1');
    }

    // A hosted environment without the password is told apart, but an e-mail off the list is still just refused.
    const hosted = appFor({ APP_ENV: 'production', SUPABASE_URL: 'https://example.supabase.co' }, signIn);
    signIn.mockClear();
    const notConfigured = await post(hosted.app, { email: 'finance@claimsiq.local' });
    expect(notConfigured.status).toBe(503);
    expect(notConfigured.json).toMatchObject({ title: 'Demo sign-in is not configured in this environment.', code: DEMO_SIGN_IN_NOT_CONFIGURED_CODE });
    expect(await post(hosted.app, { email: 'someone.else@example.com' })).toMatchObject({ status: 403 });
    expect(signIn).not.toHaveBeenCalled();

    // A malformed body is a 400/422 problem, and nothing was logged with a password or token in it.
    expect((await post(local.app, '{not json')).status).toBe(400);
    expect((await post(local.app, { email: '' })).status).toBe(422);
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/wrong-password-1|configured-pass-1|access-token-value/);
    warn.mockRestore();
    await Promise.all([local.db.destroy(), configured.db.destroy(), hosted.db.destroy()]);
  });

  it('takes the password from DEMO_SEED_PASSWORD, falls back to the local one only for APP_ENV local, and rejects a password Supabase Auth would refuse', () => {
    expect(resolveDemoPassword('local', null)).toEqual({ ok: true, password: LOCAL_DEMO_PASSWORD });
    expect(resolveDemoPassword('local', 'configured-pass-1')).toEqual({ ok: true, password: 'configured-pass-1' });
    for (const appEnv of ['dev', 'preview', 'staging', 'production']) {
      expect(resolveDemoPassword(appEnv, null)).toEqual({ ok: false });
    }
    expect(loadConfig({ ...BASE_ENV, DEMO_SEED_PASSWORD: ' spaced-pass ' }).seed.demoPassword).toBe('spaced-pass');
    expect(loadConfig({ ...BASE_ENV, DEMO_SEED_PASSWORD: '  ' }).seed.demoPassword).toBeNull();
    expect(() => loadConfig({ ...BASE_ENV, DEMO_SEED_PASSWORD: 'short' })).toThrow(ConfigurationError);
  });
});
