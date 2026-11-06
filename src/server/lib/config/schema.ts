/**
 * The typed server environment.
 *
 * Current subset: `bun run auth:personas` provisions the demo accounts, the token verifier checks real Supabase JWTs
 * and the database scripts, seed and tenancy helpers connect to Postgres, so only these variables exist yet:
 *
 * | Variable                    | Required | Purpose                                                            |
 * |-----------------------------|----------|--------------------------------------------------------------------|
 * | `API_PORT`                  | no       | Port of the local API server (`bun run dev:api`), default 5274      |
 * | `APP_ENV`                   | no       | `local` (default) / `dev` / `preview` / `staging` / `production`   |
 * | `DATABASE_URL`              | no       | Postgres connection URL (direct, not a pooler); the db scripts and tests need it |
 * | `DEMO_SEED_PASSWORD`        | no       | The password of the demo accounts in this environment (demo sign-in, `auth:personas`); `test1234` is its fallback only when `APP_ENV` is `local` |
 * | `LOG_LEVEL`                 | no       | `debug` / `info` (default) / `warn` / `error`                      |
 * | `SUPABASE_URL`              | yes      | Project URL; the JWT issuer is pinned to `<url>/auth/v1`            |
 * | `SUPABASE_ANON_KEY`         | yes      | Verification client (`getClaims` only)                              |
 * | `SUPABASE_SERVICE_ROLE_KEY` | yes      | Admin client: Auth Admin API (and Storage later). Server only.      |
 *
 * Adding a variable changes three things together: this file, `.env.example` and `.env.local.example`; a unit test
 * checks that both example files list exactly `SERVER_ENV_KEYS` plus the browser-safe `VITE_` keys.
 *
 * Blank values count as unset (`blankAsAbsent`), so a blank entry in a secret store behaves like a missing one:
 * an optional variable falls back to its default and a required one is reported by name.
 */
import { z } from 'zod';

/** `APP_ENV` values. The only behavioral branch is `!== 'local'`. */
export const APP_ENV_VALUES = ['local', 'dev', 'preview', 'staging', 'production'] as const;
export type AppEnvValue = (typeof APP_ENV_VALUES)[number];

/** `LOG_LEVEL` values, in increasing severity. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Treats `undefined`, `''` and whitespace-only strings as absent before `schema` runs. */
export function blankAsAbsent<T extends z.ZodType>(schema: T) {
  return z.preprocess((value: unknown) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }
    return typeof value === 'string' ? value.trim() : value;
  }, schema);
}

function required(name: string) {
  return z.string({ error: `${name} is required.` }).min(1, `${name} is required.`);
}

const httpUrl = (name: string) =>
  required(name).refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.username === '' && url.password === '';
    } catch {
      return false;
    }
  }, `${name} must be an absolute http(s) URL without credentials.`);

/** The raw environment variables, validated. Keys are the variable names. */
export const serverEnvSchema = z
  .object({
    API_PORT: blankAsAbsent(
      z.coerce
        .number({ error: 'API_PORT must be a TCP port between 1024 and 65535.' })
        .int('API_PORT must be a TCP port between 1024 and 65535.')
        .min(1024, 'API_PORT must be a TCP port between 1024 and 65535.')
        .max(65535, 'API_PORT must be a TCP port between 1024 and 65535.')
        .default(5274),
    ),
    APP_ENV: blankAsAbsent(z.enum(APP_ENV_VALUES, { error: `APP_ENV must be one of ${APP_ENV_VALUES.join(', ')}.` }).default('local')),
    DATABASE_URL: blankAsAbsent(
      z
        .string()
        .regex(/^postgres(ql)?:\/\/\S+$/, 'DATABASE_URL must be a postgres:// or postgresql:// connection URL.')
        .optional(),
    ),
    DEMO_SEED_PASSWORD: blankAsAbsent(
      z.string().min(6, 'DEMO_SEED_PASSWORD must have at least 6 characters (the minimum of Supabase Auth).').max(72).optional(),
    ),
    LOG_LEVEL: blankAsAbsent(z.enum(LOG_LEVELS, { error: `LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}.` }).default('info')),
    SUPABASE_URL: blankAsAbsent(httpUrl('SUPABASE_URL')),
    SUPABASE_ANON_KEY: blankAsAbsent(required('SUPABASE_ANON_KEY')),
    SUPABASE_SERVICE_ROLE_KEY: blankAsAbsent(required('SUPABASE_SERVICE_ROLE_KEY')),
  })
  .superRefine((env, ctx) => {
    // Guards: zod may run this refinement even when a member already failed.
    if (typeof env.SUPABASE_URL !== 'string' || typeof env.SUPABASE_ANON_KEY !== 'string') {
      return;
    }
    if (env.APP_ENV !== 'local' && env.SUPABASE_URL.startsWith('http:')) {
      ctx.addIssue({
        code: 'custom',
        path: ['SUPABASE_URL'],
        message: 'SUPABASE_URL must use https outside APP_ENV=local.',
      });
    }
    if (env.SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
        message: 'SUPABASE_SERVICE_ROLE_KEY must differ from SUPABASE_ANON_KEY.',
      });
    }
  });

/** Every variable name the schema reads (the example files must list exactly these plus the VITE_ keys). */
export const SERVER_ENV_KEYS = Object.keys(serverEnvSchema.shape) as ReadonlyArray<keyof typeof serverEnvSchema.shape>;

/** Browser-safe variables compiled into the SPA. They are NOT part of the server schema. */
export const BROWSER_ENV_KEYS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

/** The typed, frozen configuration handed to the rest of the server. */
export interface AppConfig {
  readonly appEnv: AppEnvValue;
  /** The port `bun run dev:api` listens on. */
  readonly apiPort: number;
  readonly logLevel: LogLevel;
  /** What the demo accounts of this environment are given. */
  readonly seed: {
    /** `DEMO_SEED_PASSWORD`, or null when unset; `resolveDemoPassword` decides what null means. */
    readonly demoPassword: string | null;
  };
  readonly database: {
    /** The Postgres connection URL, or null when `DATABASE_URL` is unset. */
    readonly url: string | null;
  };
  readonly supabase: {
    /** Project URL without a trailing slash. */
    readonly url: string;
    /** `<url>/auth/v1`: the pinned JWT issuer. */
    readonly authIssuer: string;
    /** `<url>/auth/v1/.well-known/jwks.json`. */
    readonly jwksUrl: string;
    readonly anonKey: string;
    readonly serviceRoleKey: string;
  };
}

/** Maps the validated variables to the typed configuration. */
export function toAppConfig(env: z.output<typeof serverEnvSchema>): AppConfig {
  const url = env.SUPABASE_URL.replace(/\/+$/, '');
  return {
    appEnv: env.APP_ENV,
    apiPort: env.API_PORT,
    logLevel: env.LOG_LEVEL,
    seed: { demoPassword: env.DEMO_SEED_PASSWORD ?? null },
    database: { url: env.DATABASE_URL ?? null },
    supabase: {
      url,
      authIssuer: `${url}/auth/v1`,
      jwksUrl: `${url}/auth/v1/.well-known/jwks.json`,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  };
}
