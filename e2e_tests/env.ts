import { localEnvValue } from './localEnv';

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
  const value = envValue('DATABASE_URL') ?? localEnvValue('DATABASE_URL');
  if (value === undefined) throw new Error('DATABASE_URL is not set in the environment or in .env.local.');
  return value;
}
