/** The one reader of the repository's `.env.local` for the e2e suite: Node's own .env parser, as vitest.config.ts uses (`export`, quotes and comments included). */
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const file = new URL('../.env.local', import.meta.url);

/** The value of `name` in `.env.local`, or undefined when the file or the value is missing. */
export function localEnvValue(name: string): string | undefined {
  const value = existsSync(file) ? parseEnv(readFileSync(file, 'utf8'))[name]?.trim() : undefined;
  return value === undefined || value === '' ? undefined : value;
}
