import { existsSync, readFileSync } from 'node:fs';

/** The trimmed value of an environment variable; empty or whitespace counts as unset. Every env read goes through it. */
export function envValue(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw === undefined || raw === '' ? undefined : raw;
}

/**
 * The local database the stack project runs on: `DATABASE_URL` from the environment, else from the repository's
 * `.env.local`, which the API server reads (Playwright does not load it).
 */
export function databaseUrl(): string {
  const fromEnvironment = envValue('DATABASE_URL');
  if (fromEnvironment !== undefined) return fromEnvironment;
  const file = new URL('../.env.local', import.meta.url);
  const line = existsSync(file)
    ? readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .find((candidate) => candidate.startsWith('DATABASE_URL='))
    : undefined;
  const value = line?.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  if (value === undefined || value === '') throw new Error('DATABASE_URL is not set in the environment or in .env.local.');
  return value;
}
