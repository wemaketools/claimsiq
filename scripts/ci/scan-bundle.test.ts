/**
 * Guard for the prototype scan itself: it must fail on supabase-js (code or chunk) and on a Content-Security-Policy
 * that lets a prototype build connect anywhere but its own origin, and stay quiet on a clean prototype build.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkProductionCsp, scanBundle } from './scan-bundle.js';

const inputs = { serviceRoleKey: null, demoAccountsMarker: null, prototype: true } as const;

function csp(connect: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; ${connect}" />`;
}

describe('scan-bundle in prototype mode', () => {
  it('flags supabase-js code, a supabase chunk and a foreign connect-src, and accepts a clean build', () => {
    const dist = mkdtempSync(join(tmpdir(), 'ciq-scan-'));
    try {
      mkdirSync(join(dist, 'assets'));
      writeFileSync(join(dist, 'assets', 'index-abc.js'), 'export const app = 1;');
      expect(scanBundle(dist, inputs)).toEqual([]);
      expect(checkProductionCsp(csp("connect-src 'self'"), true)).toEqual([]);

      writeFileSync(join(dist, 'assets', 'index-abc.js'), 'new GoTrueClient()');
      writeFileSync(join(dist, 'assets', 'vendor-supabase-abc.js'), 'export {}');
      const rules = scanBundle(dist, inputs).map((finding) => `${finding.file} ${finding.rule}`);
      expect(rules).toEqual(
        expect.arrayContaining(['assets/index-abc.js supabase-js', 'assets/vendor-supabase-abc.js supabase-js']),
      );
      expect(scanBundle(dist, { ...inputs, prototype: false })).toEqual([]);

      expect(checkProductionCsp(csp("connect-src 'self' http://127.0.0.1:54421"), true)).toHaveLength(1);
      expect(checkProductionCsp(csp("connect-src 'self' http://127.0.0.1:54421"))).toEqual([]);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  });
});
