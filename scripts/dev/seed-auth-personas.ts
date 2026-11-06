/**
 * `bun run auth:personas`: creates or updates the demo accounts in LOCAL Supabase Auth, one per persona.
 *
 * - Through the Auth Admin API (service-role key from `.env.local`, via src/server/lib/config): e-mail confirmed,
 *   password `test1234`, `user_metadata.full_name`. Existing accounts are updated to the same state, so the
 *   script is idempotent and repairs a changed password.
 * - The accounts only exist to sign in. The persona switch in the app is a view and does not depend on the account.
 * - Refuses to run unless SUPABASE_URL points at this machine (127.0.0.1, localhost or ::1) and APP_ENV is local.
 * - Prints progress only; never prints keys or tokens.
 *
 * The same list is shown in the sign-in quick-pick of development builds (src/ui/src/auth/demoAccountList.ts); a
 * unit test keeps the two in step.
 *
 * Usage: bun run auth:personas
 */
import { pathToFileURL } from 'node:url';

import type { SupabaseClient, User } from '@supabase/supabase-js';

import { ConfigurationError, getConfig } from '../../src/server/lib/config/index.js';
import type { AppConfig } from '../../src/server/lib/config/index.js';
import { getAdminClient } from '../../src/server/lib/supabase/index.js';

export const DEMO_PASSWORD = 'test1234';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export function isLocalTarget(config: Pick<AppConfig, 'appEnv' | 'supabase'>): boolean {
  let host: string;
  try {
    host = new URL(config.supabase.url).hostname;
  } catch {
    return false;
  }
  return config.appEnv === 'local' && LOCAL_HOSTS.has(host);
}

export interface SeedAccount {
  readonly email: string;
  readonly fullName: string;
}

/** Every account the script provisions: one per persona of the persona switch. */
export const SEED_ACCOUNTS: readonly SeedAccount[] = [
  { email: 'head.of.claims@claimsiq.local', fullName: 'Head of Claims' },
  { email: 'claims.handler@claimsiq.local', fullName: 'Claims Handler' },
  { email: 'supplier.coordinator@claimsiq.local', fullName: 'Supplier Coordinator' },
  { email: 'finance@claimsiq.local', fullName: 'Finance' },
];

async function existingUsers(admin: SupabaseClient): Promise<Map<string, User>> {
  const byEmail = new Map<string, User>();
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error !== null) {
      throw new Error(`Listing Auth users failed: ${error.message}`);
    }
    for (const user of data.users) {
      if (typeof user.email === 'string') {
        byEmail.set(user.email.toLowerCase(), user);
      }
    }
    if (data.users.length < perPage) {
      return byEmail;
    }
  }
}

export interface SeedSummary {
  readonly created: number;
  readonly updated: number;
}

/** Creates or updates every account. */
export async function seedAuthPersonas(
  admin: SupabaseClient,
  accounts: readonly SeedAccount[],
): Promise<SeedSummary> {
  const users = await existingUsers(admin);
  let created = 0;
  let updated = 0;
  for (const account of accounts) {
    const attributes = {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: account.fullName },
    };
    const existing = users.get(account.email.toLowerCase());
    if (existing === undefined) {
      const { error } = await admin.auth.admin.createUser({ email: account.email, ...attributes });
      if (error !== null) {
        throw new Error(`Creating ${account.email} failed: ${error.message}`);
      }
      created += 1;
    } else {
      const { error } = await admin.auth.admin.updateUserById(existing.id, attributes);
      if (error !== null) {
        throw new Error(`Updating ${account.email} failed: ${error.message}`);
      }
      updated += 1;
    }
  }
  return { created, updated };
}

async function main(): Promise<void> {
  let config: AppConfig;
  try {
    config = getConfig();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      process.stderr.write(`${error.message}\nWrite .env.local first (see README.md, Local development).\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  if (!isLocalTarget(config)) {
    process.stderr.write(
      'Refusing to provision demo accounts: SUPABASE_URL must point at the local stack (127.0.0.1/localhost) ' +
        'and APP_ENV must be local.\n',
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Provisioning ${SEED_ACCOUNTS.length} demo accounts in local Supabase Auth (${config.supabase.url})...\n`,
  );
  const summary = await seedAuthPersonas(getAdminClient(config), SEED_ACCOUNTS);
  process.stdout.write(
    `Done: ${summary.created} created, ${summary.updated} updated. Password for every account: ${DEMO_PASSWORD} (local only).\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    process.stderr.write(`auth:personas failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
