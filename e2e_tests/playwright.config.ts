/**
 * Playwright configuration. The SPA runs on the Vite dev server and signs in with REAL Supabase Auth.
 * Playwright starts the dev server itself on WEB_PORT (default 5380), so a run never collides with a developer's
 * `bun run dev` on 5273. A stale server on that port fails the run loudly instead of silently serving old code.
 *
 * Prerequisites: Docker running, the local Supabase stack started (`bun run supabase:start`), the root
 * `.env.local` written, and the demo accounts created (`bun run auth:personas`).
 *
 * Run from the repository root: `bun run test:e2e`.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const uiDir = fileURLToPath(new URL('../src/ui', import.meta.url));

function portFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`${name} must be a TCP port between 1024 and 65535, got "${raw}".`);
  }
  return value;
}

const webPort = portFromEnv('WEB_PORT', 5380);
const webOrigin = `http://127.0.0.1:${webPort}`;
const isCI = Boolean(process.env.CI);

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
  use: {
    ...devices['Desktop Chrome'],
    baseURL: webOrigin,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: `bun run dev --host 127.0.0.1 --port ${webPort} --strictPort`,
    cwd: uiDir,
    url: webOrigin,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
