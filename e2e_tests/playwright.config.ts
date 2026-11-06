/**
 * Playwright configuration, two projects:
 * - `stack`: the SPA on the Vite dev server, signing in with REAL Supabase Auth. Playwright starts the dev server
 *   itself on WEB_PORT (default 5380), so a run never collides with a developer's `bun run dev` on 5273. A stale
 *   server on that port fails the run loudly instead of silently serving old code. Prerequisites: Docker running,
 *   the local Supabase stack started (`bun run supabase:start`), the root `.env.local` written, and the demo accounts
 *   created (`bun run auth:personas`).
 * - `prototype`: a PRODUCTION build in prototype mode (`vite build`, then `vite preview` on PROTOTYPE_PORT, default
 *   5381), the static demo Kwaku deploys. It needs no stack and signs in by clicking a role.
 *
 * Run from the repository root: `bun run test:e2e`, or `bun run test:e2e:prototype` for the second project alone. A
 * run starts only the servers of the projects it runs (`E2E_PROJECT`, set by `test:e2e:prototype`), so the prototype
 * run needs no stack and no dev server.
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
const prototypePort = portFromEnv('PROTOTYPE_PORT', 5381);
const isCI = Boolean(process.env.CI);

/** Each project with the server it needs: the one home of both, so a project never starts another's server. */
const PROJECTS = [
  {
    name: 'stack',
    testMatch: ['claims.spec.ts', 'shell.spec.ts'],
    origin: `http://127.0.0.1:${webPort}`,
    server: {
      command: `bun run dev --host 127.0.0.1 --port ${webPort} --strictPort`,
      timeout: 120_000,
    },
  },
  {
    name: 'prototype',
    testMatch: ['prototype.spec.ts'],
    origin: `http://127.0.0.1:${prototypePort}`,
    server: {
      // The build goes to its own folder, so a developer's `dist` is left alone.
      command: `bun run build:prototype --outDir dist-prototype && bunx vite preview --outDir dist-prototype --host 127.0.0.1 --port ${prototypePort} --strictPort`,
      timeout: 180_000,
    },
  },
] as const;

const selected = process.env.E2E_PROJECT;
const running = PROJECTS.filter((project) => selected === undefined || project.name === selected);
if (running.length === 0) {
  throw new Error(`E2E_PROJECT must be one of ${PROJECTS.map((project) => project.name).join(', ')}, got "${selected}".`);
}

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
  webServer: running.map((project) => ({
    command: project.server.command,
    cwd: uiDir,
    url: project.origin,
    reuseExistingServer: false,
    timeout: project.server.timeout,
    stdout: 'ignore',
    stderr: 'pipe',
  })),
});
