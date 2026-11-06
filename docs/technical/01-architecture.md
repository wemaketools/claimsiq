# Architecture and stack

Status: as built (scaffold, data layer, rules engine and, from Stage B, the database and the API). The decisions behind it are in `docs/plan/design-decisions.md`. Product behaviour: `ai/specs/`.

## Repository layout

| Path | Contents |
|---|---|
| `src/ui/` | The SPA, Bun workspace `@claimsiq/ui` (see [02-frontend.md](02-frontend.md)) |
| `src/contracts/` | Pure TypeScript + zod (+ decimal.js for money), shared by the SPA, the mock API and the backend later: the 17 entities keyed (tenant_id, id), the typed endpoints, the data sets, the personas, the money and time helpers |
| `src/rules/` | The claims rules engine: pure functions over the contracts (`config.ts` the validated rule config, `calendar.ts` business days, `claimFacts.ts` the facts of one claim, `summary.ts` portfolio totals, `suppliers.ts` per-supplier figures, `tasks.ts` the overdue rule). Imports only zod, decimal.js and `src/contracts` (lint-enforced); see DD-22 to DD-27, DD-40 to DD-42 |
| `src/read-model/` | The record sets and the reads both transports answer through (DD-55), pure like the rules: `fixtures/` (CSV reader, loader, validation and quarantine), `asOfViews.ts` (claims and invoices as an as-of date sees them), `reads.ts` (the answer of every read endpoint over a `ReadModel`, including `claims.facts` and `suppliers.insights`, which run `src/rules`), `taskRules.ts` (create, assign and change status, audit entry included), `problems.ts` (field problems and `InvalidValues`, the 422 both transports give), `test-support/` (`withEdit` and the generated claims fixture of DD-31, for tests). Imports only zod, decimal.js, `src/contracts` and `src/rules` (lint-enforced) |
| `src/mock-api/` | The prototype's API, in the browser: `api.ts` (the endpoints as a `fetch`-shaped function; it builds a `ReadModel` from the fixtures and the changes kept in browser storage and answers through `src/read-model`), `changes.ts` (tasks kept in browser storage). It takes no Node module outside its tests |
| `fixtures/v1/` | The spec's synthetic data: `test/` and `demo/` CSV folders, `expected_metrics.json`, `proposed_rule_config.json`, the README |
| `src/server/lib/` | `config` (the one reader of `process.env`, including `DATABASE_URL` and `API_PORT`), `supabase` (server clients, JWKS cache), `auth` (`verify.ts`: access-token verification; `middleware.ts`: the session middleware), `db` (the Kysely client, the generated table types, `withTenant` and the tenant scope, DD-50), `tenancy` (`resolveTenantAccess` and the tenant middleware), `errors` (problem+json), `router` (`app.ts`: the Hono app and its middleware; `contract.ts`: one route per contract endpoint), `read-model` (database rows into the shared `ReadModel`) and `seed` (the fixture readers and `replaceDataSetRows`, which the seed and Reset share) |
| `src/server/domains/` | The handlers by area: `reads` (every read endpoint), `tasks` (create, assign, status), `demo` (Reset) |
| `api/v1/index.ts` | The Vercel function for the whole of `/api/v1`, the same Hono app (DD-54); kept out of the deploy until a hosted database exists (DD-59) |
| `src/server/tests/unit/` | Tests of the platform modules; the ones that verify real tokens need the local Supabase stack and skip themselves without it |
| `scripts/ci/` | `scan-secrets`, `scan-bundle`, `assert-test-run` (the CI checks) |
| `scripts/db/` | `reset.ts` (`db:reset`), `seed.ts` (`db:seed`), `generate-types.ts` (`db:types`), `local.ts` and `localHost.ts` (the local-only guard), `connection.ts` (plain connections, always closed), `scratchDatabase.ts` and the database tests (`seed.test.ts`, `isolation.test.ts`); `ensure-signing-keys.mjs`: the git-ignored ES256 key set the local Auth stack signs with |
| `scripts/dev/` | `seed-auth-personas.ts` (the four demo accounts), `serve-api.ts` (`dev:api`: the Hono app over `node:http`) and `dev-all.ts` (`dev`: the API and the SPA together) |
| `supabase/` | `config.toml` of the local stack (project id `claimsiq`, default ports plus 100) and `migrations/`, the schema as plain SQL |
| `e2e_tests/` | Playwright + axe workspace `@claimsiq/e2e` |
| `.github/workflows/ci.yml` | The single `verify` job |

The lint config guards `src/contracts`, `src/rules` and `src/read-model` (pure), `src/mock-api` (browser-safe, never imported by `src/server` or `api/`) and the SPA's use of the mock API (only `src/ui/src/api/mockTransport.ts`).

## Data flow

The SPA calls typed endpoints through `call()`; which transport answers is chosen when the app is built (DD-58).

- **Prototype build:** the transport adapter sends the request to the mock API in the browser, which answers from the parsed CSV fixtures (selected by `X-Tenant-Id`, limited by `X-As-Of`) plus the changes kept in `localStorage`.
- **Every other build (Supabase mode):** the platform `fetch` sends it to `/api/v1` on the app's own origin (Vite proxies it to the API server in development; a Vercel function once a hosted database exists, DD-59), with the session's bearer token. The Hono app verifies the token, checks `X-Tenant-Id` against the user's memberships on every request, validates the query and body with the contract's zod schemas and runs the handler inside `withTenant`. Reads load the tenant's rows into the shared `ReadModel` and answer through `src/read-model`, which runs the rules engine; commands apply the shared task rules and write the row and its audit entry in one transaction. The answer is checked against the contract's response schema before it leaves.

The two transports answer through the same `src/read-model`, so contracts, screens and figures are identical; `scripts/db/api-parity.test.ts` proves it on every read endpoint.

## Database (Stage B)

The local Supabase Postgres (127.0.0.1:54422) holds the application schema, built by the migrations in `supabase/migrations` (DD-49 to DD-53):

- **Tables:** the 17 entities of `src/contracts/entities.ts`, each keyed `(tenant_id, <entity>_id)` with composite foreign keys that carry the tenant, plus `tasks`' audit trail (`task_audit_entries`, append only) and id counter (`task_counters`), `tenant_memberships` (Supabase Auth user, tenant, starting persona) and `rule_configs` (the rule configuration per tenant and data set). Money is `numeric(18,2)`; a contract `Moment` is text in the `moment` domain, a system `Instant` is `timestamptz`.
- **Tenants:** `TEST` and `DEMO` are two tenants of one database. Isolation is two layers: the API runs each request in `withTenant` (role `claimsiq_app`, `app.tenant_id` set for the transaction, queries scoped by `tenant_id`), and row level security on every tenant table enforces the same by policy. The owner role bypasses RLS and is used only by migrations, the seed and the membership lookup. `anon` and `authenticated` have no table privileges.
- **Types:** `src/server/lib/db/generated/schema.ts` is written by `bun run db:types` from the live schema; a test fails when it is stale.
- **Data:** `bun run db:seed` loads `fixtures/v1/test` and `fixtures/v1/demo` through the `src/read-model` loader, the mock API's too (quarantined rows are reported, not inserted) and links the demo accounts to both tenants; `bun run db:reset` rebuilds everything locally. TEST reconciles to `expected_metrics.json` in the database too (6 claims, 9,000.00 paid, 68,000.00 reserve).
- **For the API (DD-55 to DD-57):** `row_no` (the fixture's row order), `data_issues` (what the loader rejected or flagged at seed time) and `task_audit_entries.actor_user_id` (the signed-in account behind a task change). The seed and the API's Reset share `replaceDataSetRows`.

## Stack

Bun (pinned in `.bun-version` and `packageManager`; `bun.lock` is committed) as package manager and script runner, TypeScript ~6 strict, ESM. SPA: React 18.3, Vite 8, Redux Toolkit 2, React Router 7, recharts 3, zod 4, supabase-js 2. Tests: Vitest 5, React Testing Library, jest-dom, Playwright, axe. Backend: Kysely over `pg` (the database layer) and Hono (the API).

Two TypeScript projects: `tsconfig.server.json` (NodeNext, `src/server`, `scripts`, `vitest.config.ts`; relative imports carry `.js`) and `src/ui/tsconfig.app.json` (bundler resolution, `jsx: react-jsx`). Two ESLint configs: the root one (backend, scripts) and `src/ui/eslint.config.js`.

## Authentication

Sign-in is email and password through supabase-js against Supabase Auth in the local Docker stack. The browser Supabase client (`src/ui/src/auth/supabase.ts`) is used for authentication only; the API receives the access token as a bearer token. The stack signs tokens with an asymmetric ES256 key from `supabase/signing_keys.json`; `src/server/lib/auth/verify.ts` verifies a token against the published JWKS (algorithm allow-list, pinned issuer, `role = authenticated`). Self-signup is off; accounts are provisioned through the Auth Admin API (`bun run auth:personas`).

The persona switch is not authentication (DD-07).

A **prototype build** (`VITE_AUTH_MODE=prototype`, DD-45 to DD-47) has no Supabase at all: the session is the demo role picked on the sign-in page, kept in `localStorage`; the API is the in-browser mock API; supabase-js is not in the bundle (`scan-bundle --prototype` proves it). It needs no environment variable and is what `vercel.json` builds.

## Environment

`.env.example` (deployed catalog) and `.env.local.example` (local) list exactly the variables of `src/server/lib/config/schema.ts` plus the browser-safe `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; a unit test enforces that and that no value is a real key. Vite reads `.env.local` from the repository root (`envDir`). Nothing but the `VITE_` values (`VITE_AUTH_MODE` and the two Supabase ones) may reach the browser; a prototype build needs none of them set; `scan-bundle` fails the build if a server variable name, server code, a service-role key or the demo-accounts marker is in `src/ui/dist`.

## Checks and CI

`bun run verify` = typecheck, typecheck:ui, lint, lint:ui, test, test:ui, build:ui. CI (`ci.yml`) starts the local stack, writes a throwaway `.env.local`, applies the migrations, rebuilds the database with `db:reset` (migrations, demo accounts, seed), then runs the same steps plus `ci:test:unit` and `ci:test:ui` (fails on skipped tests and below the count floor), `ci:security` and the Playwright suite. The count floors in `package.json` (`ci:test:ui`, `ci:test:unit`) are raised whenever tests are added.

## Deployment

The hosted demo is the static prototype build below; it calls no API. `.vercelignore` leaves `api/` (the Hono function) out of the deploy, and `vercel.json` has no `/api/v1` rewrite or function entry, so the deploy has no function and needs no database environment; the API ships only once a hosted database exists, and DD-59 lists the three lines to restore (Reset also answers 403 unless `APP_ENV` is `local` or `dev`, DD-57).

Vercel installs with `bun install --frozen-lockfile`, builds with `VITE_AUTH_MODE=prototype bun run build` (typecheck, then the SPA build in prototype mode: static files, no environment variables) and serves `src/ui/dist` with an SPA rewrite so deep links such as `/claims/DCLM-002` open. The Content-Security-Policy is a meta tag filled in by `vite.config.ts`: production allows scripts from the app's own origin and network to the app and the Supabase URL only (the app alone in a prototype build); the development server adds `'unsafe-inline'` scripts and websockets for hot reload.
