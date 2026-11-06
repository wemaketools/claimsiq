/** The guard of every destructive database script: only the local Docker stack may be reset. */
import type { AppConfig } from '../../src/server/lib/config/index.js';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export function isLocalDatabase(config: Pick<AppConfig, 'appEnv' | 'database'>): boolean {
  if (config.appEnv !== 'local' || config.database.url === null) {
    return false;
  }
  try {
    return LOCAL_HOSTS.has(new URL(config.database.url).hostname);
  } catch {
    return false;
  }
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
