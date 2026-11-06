import { describe, expect, it } from 'vitest';

import { isLocalTarget } from './seed-auth-personas.js';

function config(appEnv: string, url: string) {
  return { appEnv, supabase: { url } } as unknown as Parameters<typeof isLocalTarget>[0];
}

describe('isLocalTarget', () => {
  it.each([
    ['local', 'http://127.0.0.1:54331', true],
    ['local', 'http://localhost:54331', true],
    ['local', 'https://abc.supabase.co', false],
    ['production', 'http://127.0.0.1:54331', false],
    ['local', 'not a url', false],
  ])('is decided by environment %s and URL %s', (appEnv, url, expected) => {
    expect(isLocalTarget(config(appEnv, url))).toBe(expected);
  });
});
