/** The one reader of the repository's `.env.local` for the e2e suite: Node's own .env parser, as vitest.config.ts uses (`export`, quotes and comments included). */
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { envValue, presentValue } from './env';

const file = new URL('../.env.local', import.meta.url);

/**
 * The local database the stack project runs on: `DATABASE_URL` from the environment, else from the repository's
 * `.env.local`, which the API server reads (Playwright does not load it).
 */
export function databaseUrl(): string {
  const fromFile = presentValue(existsSync(file) ? parseEnv(readFileSync(file, 'utf8'))['DATABASE_URL'] : undefined);
  const value = envValue('DATABASE_URL') ?? fromFile;
  if (value === undefined) throw new Error('DATABASE_URL is not set in the environment or in .env.local.');
  return value;
}
