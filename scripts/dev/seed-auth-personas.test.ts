import { describe, expect, it } from 'vitest';

import { isLocalTarget } from './seed-auth-personas.js';

function config(appEnv: string, url: string) {
  return { appEnv, supabase: { url } } as unknown as Parameters<typeof isLocalTarget>[0];
}

describe('isLocalTarget', () => {
  it('accepts only a local environment pointing at this machine', () => {
    expect(isLocalTarget(config('local', 'http://127.0.0.1:54421'))).toBe(true);
    expect(isLocalTarget(config('local', 'http://localhost:54421'))).toBe(true);
    expect(isLocalTarget(config('local', 'https://abc.supabase.co'))).toBe(false);
    expect(isLocalTarget(config('production', 'http://127.0.0.1:54421'))).toBe(false);
    expect(isLocalTarget(config('local', 'not a url'))).toBe(false);
  });
});
