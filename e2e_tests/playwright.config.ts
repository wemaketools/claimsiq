/**
 * Playwright configuration, two projects:
 * - `stack`: the SPA on the Vite dev server, signing in with REAL Supabase Auth and reading and writing through the
 *   REAL API (`scripts/dev/serve-api.ts`) and the local database. Playwright starts both itself, the dev server on
 *   WEB_PORT (default 5380) and the API on E2E_API_PORT (default 5382), so a run never collides with a developer's
 *   `bun run dev` on 5273 and 5274. A stale server on a port fails the run loudly instead of silently serving old
 *   code. Prerequisites: Docker running, the local Supabase stack started (`bun run supabase:start`), the root
 *   `.env.local` written, and the database built (`bun run db:reset`, which also creates the demo accounts). The specs
 *   change TEST and DEMO data and end with Reset.
 * - `prototype`: a PRODUCTION build in prototype mode (`vite build`, then `vite preview` on PROTOTYPE_PORT, default
 *   5381), the static demo Kwaku deploys. It needs no stack and signs in by clicking a role.
 *
 * Run from the repository root: `bun run test:e2e`, or `bun run test:e2e:prototype` for the second project alone. A
 * run starts only the servers of the projects it runs (`E2E_PROJECT`, set by `test:e2e:prototype`), so the prototype
 * run needs no stack and no dev server.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

import { envValue } from './env';
import { running } from './projects';
import type { ServerSpec } from './projects';

const uiDir = fileURLToPath(new URL('../src/ui', import.meta.url));
const rootDir = fileURLToPath(new URL('..', import.meta.url));
const isCI = envValue('CI') !== undefined;

export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  ...(isCI ? { workers: 2 } : {}),
  reporter: isCI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  projects: running.map((project) => ({
    name: project.name,
    testMatch: [...project.testMatch],
    use: { baseURL: project.origin },
  })),
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: running.flatMap((project) =>
    (project.servers as readonly ServerSpec[]).map((server) => ({
      command: server.command,
      cwd: server.cwd === 'ui' ? uiDir : rootDir,
      url: server.url,
      reuseExistingServer: false,
      timeout: server.timeout,
      ...(server.env === undefined ? {} : { env: { ...server.env } }),
      stdout: 'ignore' as const,
      stderr: 'pipe' as const,
    })),
  ),
});
