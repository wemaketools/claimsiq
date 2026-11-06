/**
 * Root Vitest configuration.
 *
 * Two projects:
 * - `unit`: pure tests in a node environment: src/server/tests/unit, contract tests, mock API tests, rules tests and script
 *   tests. Some platform tests verify REAL Supabase JWTs against the local stack and skip when it is not running.
 * - `integration`: backend tests against the real local Supabase stack, serial, with 180 s timeouts.
 *
 * Environment: tests see the values of the git-ignored `.env.local` in process.env, mirroring the
 * `.env.local` convention of the package scripts. Code under test still reads them only
 * through src/server/lib/config.
 *
 * Adding the integration suite needs no edit of this file:
 * - `passWithNoTests` is a root-only Vitest option. It is on only while src/server/tests/integration does not exist,
 *   so `vitest run --project integration` succeeds before the suite is written.
 * - The integration `globalSetup` is loaded from src/server/tests/helpers/global-setup.ts as soon as that file exists.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

const fromRoot = (relativePath: string): string => fileURLToPath(new URL(relativePath, import.meta.url));

const envFile = fromRoot('./.env.local');
const localEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};

const integrationSuite = fromRoot('./src/server/tests/integration');
const integrationGlobalSetup = fromRoot('./src/server/tests/helpers/global-setup.ts');

export default defineConfig({
  test: {
    env: localEnv,
    passWithNoTests: !existsSync(integrationSuite),
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'src/server/tests/unit/**/*.test.ts',
            'src/contracts/**/*.test.ts',
            'src/mock-api/**/*.test.ts',
            'src/rules/**/*.test.ts',
            'scripts/**/*.test.ts',
          ],
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/server/tests/integration/**/*.test.ts'],
          testTimeout: 180_000,
          hookTimeout: 180_000,
          fileParallelism: false,
          globalSetup: existsSync(integrationGlobalSetup) ? [integrationGlobalSetup] : [],
        },
      },
    ],
  },
});
