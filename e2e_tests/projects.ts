/**
 * The e2e projects, each with the server it needs: the one home of both, so a project never starts another's server.
 * `E2E_PROJECT` (set by `test:e2e:prototype`) selects one; unset runs all.
 */
import { envValue } from './env';

function portFromEnv(name: string, fallback: number): number {
  const raw = envValue(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`${name} must be a TCP port between 1024 and 65535, got "${raw}".`);
  }
  return value;
}

const webPort = portFromEnv('WEB_PORT', 5380);
const prototypePort = portFromEnv('PROTOTYPE_PORT', 5381);

export const PROJECTS = [
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

const selected = envValue('E2E_PROJECT');
export const running = PROJECTS.filter((project) => selected === undefined || project.name === selected);
if (running.length === 0) {
  throw new Error(`E2E_PROJECT must be one of ${PROJECTS.map((project) => project.name).join(', ')}, got "${selected}".`);
}

