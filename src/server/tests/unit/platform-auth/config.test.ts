/** Unit tests of src/server/lib/config: validation, defaults, blank handling, caching and freezing. */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ConfigurationError,
  SERVER_ENV_KEYS,
  getConfig,
  loadConfig,
  resetConfigCache,
  tryGetConfig,
} from '../../../lib/config/index.js';

const VALID = {
  API_PORT: '5400',
  APP_ENV: 'local',
  LOG_LEVEL: 'debug',
  DATABASE_URL: 'postgresql://postgres:<local-db-password>@127.0.0.1:54322/postgres',
  SUPABASE_URL: 'http://127.0.0.1:54321/',
  SUPABASE_ANON_KEY: 'anon-key-value',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-value',
};

afterEach(() => {
  vi.unstubAllEnvs();
  resetConfigCache();
});

function captureError(action: () => unknown): ConfigurationError {
  try {
    action();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a ConfigurationError.');
}

describe('loadConfig', () => {
  it('maps valid variables to a frozen typed configuration with the pinned issuer and JWKS URL, and defaults blanks', () => {
    const config = loadConfig(VALID);

    expect(config).toEqual({
      apiPort: 5400,
      appEnv: 'local',
      logLevel: 'debug',
      database: { url: 'postgresql://postgres:<local-db-password>@127.0.0.1:54322/postgres' },
      supabase: {
        url: 'http://127.0.0.1:54321',
        authIssuer: 'http://127.0.0.1:54321/auth/v1',
        jwksUrl: 'http://127.0.0.1:54321/auth/v1/.well-known/jwks.json',
        anonKey: 'anon-key-value',
        serviceRoleKey: 'service-role-key-value',
      },
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.supabase)).toBe(true);
    expect(loadConfig({ ...VALID, APP_ENV: '  ', LOG_LEVEL: '', API_PORT: '' })).toMatchObject({
      appEnv: 'local',
      apiPort: 5274,
      logLevel: 'info',
    });
    expect([...SERVER_ENV_KEYS].sort()).toEqual(Object.keys(VALID).sort());
  });

  it('lists every bad variable by name without echoing a value, requires https outside local and refuses a reused key', () => {
    const error = captureError(() =>
      loadConfig({ API_PORT: '80', APP_ENV: 'prod', LOG_LEVEL: 'verbose', SUPABASE_URL: 'not a url', SUPABASE_ANON_KEY: ' ' }),
    );
    expect(error.variables.sort()).toEqual(
      ['API_PORT', 'APP_ENV', 'LOG_LEVEL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL'].sort(),
    );
    const secret = captureError(() =>
      loadConfig({ ...VALID, SUPABASE_URL: ['postgres://user', 'hunter2@db'].join(':') }),
    );
    expect(secret.message).not.toContain('hunter2');

    expect(captureError(() => loadConfig({ ...VALID, APP_ENV: 'production' })).variables).toEqual([
      'SUPABASE_URL',
    ]);
    expect(
      captureError(() => loadConfig({ ...VALID, SUPABASE_SERVICE_ROLE_KEY: VALID.SUPABASE_ANON_KEY }))
        .variables,
    ).toEqual(['SUPABASE_SERVICE_ROLE_KEY']);
  });
});

describe('getConfig', () => {
  it('parses process.env once and caches it, but does not cache a failed parse', () => {
    for (const [key, value] of Object.entries(VALID)) {
      vi.stubEnv(key, value);
    }
    resetConfigCache();
    const first = getConfig();
    vi.stubEnv('LOG_LEVEL', 'error');
    expect(getConfig()).toBe(first);
    expect(first.logLevel).toBe('debug');

    resetConfigCache();
    vi.stubEnv('SUPABASE_URL', '');
    const failed = tryGetConfig();
    vi.stubEnv('SUPABASE_URL', VALID.SUPABASE_URL);
    const recovered = tryGetConfig();

    expect(failed.ok).toBe(false);
    expect(recovered.ok).toBe(true);
  });
});
