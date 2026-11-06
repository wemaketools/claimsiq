/** The one definition of "this machine" for every script that refuses to touch anything else. */
import type { AppConfig } from '../../src/server/lib/config/index.js';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function isLocalDatabase(config: Pick<AppConfig, 'appEnv' | 'database'>): boolean {
  return config.appEnv === 'local' && config.database.url !== null && isLocalUrl(config.database.url);
}

/** The database URL, or an error that says what to do; throws unless the target is the local stack. */
export function requireLocalDatabaseUrl(config: Pick<AppConfig, 'appEnv' | 'database'>): string {
  if (config.database.url === null) {
    throw new Error('DATABASE_URL is not set. Add the DB_URL of `bun run supabase:status` to .env.local (see .env.local.example).');
  }
  if (!isLocalDatabase(config)) {
    throw new Error('Refusing to touch this database: DATABASE_URL must point at the local stack (127.0.0.1/localhost) and APP_ENV must be local.');
  }
  return config.database.url;
}
