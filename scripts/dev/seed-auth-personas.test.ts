import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DEMO_PASSWORD, SEED_ACCOUNTS, isLocalTarget } from './seed-auth-personas.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

function config(appEnv: string, url: string) {
  return { appEnv, supabase: { url } } as unknown as Parameters<typeof isLocalTarget>[0];
}

describe('demo accounts', () => {
  it('are the ones the sign-in quick-pick of development builds lists, with the same password', () => {
    const quickPick = readFileSync(`${root}src/ui/src/auth/demoAccountList.ts`, 'utf8');

    const listed = [...quickPick.matchAll(/email: '([^']+)'/g)].map((match) => match[1]);

    expect(listed).toEqual(SEED_ACCOUNTS.map((account) => account.email));
    expect(quickPick).toContain(`DEMO_PASSWORD = '${DEMO_PASSWORD}'`);
  });

  it('cover the four personas of the persona switch', () => {
    expect(SEED_ACCOUNTS.map((account) => account.fullName)).toEqual([
      'Head of Claims',
      'Claims Handler',
      'Supplier Coordinator',
      'Finance',
    ]);
  });
});

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
