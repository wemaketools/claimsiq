/**
 * `bun run db:reset`: rebuilds the LOCAL database from nothing: every migration, then the demo accounts, then the
 * fixture seed. Refuses anything but the local Docker stack (APP_ENV=local and a local DATABASE_URL).
 *
 * `supabase db reset` recreates the database, Auth's tables included, so the accounts are provisioned again before
 * the seed links them to their tenants.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { getConfig } from '../../src/server/lib/config/index.js';
import { requireLocalDatabaseUrl } from './local.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${String(result.status ?? result.signal)}).`);
  }
}

function main(): void {
  requireLocalDatabaseUrl(getConfig());
  run(process.execPath, ['scripts/db/ensure-signing-keys.mjs']);
  run('supabase', ['db', 'reset', '--local']);
  run(process.execPath, ['scripts/dev/seed-auth-personas.ts']);
  run(process.execPath, ['scripts/db/seed.ts']);
}

try {
  main();
} catch (error) {
  process.stderr.write(`db:reset failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
