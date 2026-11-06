# Architecture and stack

Status: as built (scaffold, data layer and rules engine). The decisions behind it are in `docs/plan/design-decisions.md`. Product behaviour: `ai/specs/`.

## Repository layout

| Path | Contents |
|---|---|
| `src/ui/` | The SPA, Bun workspace `@claimsiq/ui` (see [02-frontend.md](02-frontend.md)) |
| `src/contracts/` | Pure TypeScript + zod (+ decimal.js for money), shared by the SPA, the mock API and the backend later: the 17 entities keyed (tenant_id, id), the typed endpoints, the data sets, the personas, the money and time helpers |
| `src/rules/` | The claims rules engine: pure functions over the contracts (`config.ts` the validated rule config, `calendar.ts` business days, `claimFacts.ts` the facts of one claim, `summary.ts` portfolio totals). Imports only zod, decimal.js and `src/contracts` (lint-enforced); see DD-22 to DD-27 |
| `src/mock-api/` | The Stage A mock API: `fixtures/` (CSV reader, loader, validation and quarantine), `api.ts` (the endpoints as a `fetch`-shaped function, including `claims.facts`, which runs `src/rules`), `asOfViews.ts` (claims and invoices as an as-of date sees them), `changes.ts` (tasks kept in browser storage). It takes no Node module outside its tests |
| `fixtures/v1/` | The spec's synthetic data: `test/` and `demo/` CSV folders, `expected_metrics.json`, `proposed_rule_config.json`, the README |
| `src/server/lib/` | Platform modules only: `config` (the one reader of `process.env`), `supabase` (server clients, JWKS cache), `auth/verify.ts` (access-token verification) |
| `src/server/tests/unit/` | Tests of those modules; the ones that verify real tokens need the local Supabase stack and skip themselves without it |
| `scripts/ci/` | `scan-secrets`, `scan-bundle`, `assert-test-run` (the CI checks) |
| `scripts/db/` | `ensure-signing-keys.mjs`: the git-ignored ES256 key set the local Auth stack signs with |
| `scripts/dev/` | `seed-auth-personas.ts`: the four demo accounts |
| `supabase/` | `config.toml` of the local stack (project id `claimsiq`, default ports plus 100) |
| `e2e_tests/` | Playwright + axe workspace `@claimsiq/e2e` |
| `.github/workflows/ci.yml` | The single `verify` job |

`api/` (Vercel functions) comes with the backend. The lint config guards `src/contracts` and `src/rules` (pure), `src/mock-api` (browser-safe, never imported by `src/server` or `api/`) and the SPA's use of the mock API (only `src/ui/src/api/mockTransport.ts`).

## Data flow (Stage A)

The SPA calls typed endpoints through `call()`; the transport adapter sends the request to the mock API in the browser, which answers from the parsed CSV fixtures (selected by `X-Tenant-Id`, limited by `X-As-Of`) plus the changes kept in `localStorage`. Stage B replaces the transport with the platform `fetch` and the mock API with the server; contracts and screens stay (DD-16).

## Stack

Bun (pinned in `.bun-version` and `packageManager`; `bun.lock` is committed) as package manager and script runner, TypeScript ~6 strict, ESM. SPA: React 18.3, Vite 8, Redux Toolkit 2, React Router 7, recharts 3, zod 4, supabase-js 2. Tests: Vitest 5, React Testing Library, jest-dom, Playwright, axe. Backend (declared, not built): Hono, Kysely, `pg`.

Two TypeScript projects: `tsconfig.server.json` (NodeNext, `src/server`, `scripts`, `vitest.config.ts`; relative imports carry `.js`) and `src/ui/tsconfig.app.json` (bundler resolution, `jsx: react-jsx`). Two ESLint configs: the root one (backend, scripts) and `src/ui/eslint.config.js`.

## Authentication

Sign-in is email and password through supabase-js against Supabase Auth in the local Docker stack. The browser Supabase client (`src/ui/src/auth/supabase.ts`) is used for authentication only. The stack signs tokens with an asymmetric ES256 key from `supabase/signing_keys.json`; `src/server/lib/auth/verify.ts` verifies a token against the published JWKS (algorithm allow-list, pinned issuer, `role = authenticated`). Self-signup is off; accounts are provisioned through the Auth Admin API (`bun run auth:personas`).

The persona switch is not authentication (DD-07).

## Environment

`.env.example` (deployed catalog) and `.env.local.example` (local) list exactly the variables of `src/server/lib/config/schema.ts` plus the browser-safe `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; a unit test enforces that and that no value is a real key. Vite reads `.env.local` from the repository root (`envDir`). Nothing but the two `VITE_` values may reach the browser; `scan-bundle` fails the build if a server variable name, server code, a service-role key or the demo-accounts marker is in `src/ui/dist`.

## Checks and CI

`bun run verify` = typecheck, typecheck:ui, lint, lint:ui, test, test:ui, build:ui. CI (`ci.yml`) starts the local stack, writes a throwaway `.env.local`, seeds the demo accounts, then runs the same steps plus `ci:test:ui` (fails on skipped tests and below the count floor), `ci:security` and the Playwright suite. The count floors in `package.json` (`ci:test:ui`, `ci:test:unit`) are raised whenever tests are added.

## Deployment

Vercel installs with `bun install --frozen-lockfile`, builds with `bun run build` (typecheck, then the SPA build) and serves `src/ui/dist` with an SPA rewrite. The Content-Security-Policy is a meta tag filled in by `vite.config.ts`: production allows scripts from the app's own origin and network to the app and the Supabase URL only; the development server adds `'unsafe-inline'` scripts and websockets for hot reload.
