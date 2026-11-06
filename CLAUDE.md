To ask the owner for a settings change, use `converse permit` and make the change only when their confirmed answer reaches you.

# ClaimsIQ: instructions for agents

ClaimsIQ ("Claims Intelligence") is the claims control tower of The Brittany insurance intelligence suite, built to read as one suite with TenderIQ and QuoteIQ. TypeScript everywhere, React 18 SPA on Vite, Supabase Auth for sign-in, Hono API on Vercel functions later.

## Where the truth lives

Read before writing anything, in this order of precedence:

1. `ai/specs/`: the product specifications (the Complete Insurance Intelligence Build Pack, the editable Word sources `01_Shared_Foundation`, `03_ClaimsIQ_Requirements`, the synthetic TEST and DEMO data with `expected_metrics.json`, the Commercial Product Pulse). They define screens (CLM-01 to 06), requirements (CLM-FR-xx), rules, acceptance tests (CLM-AT-xx) and the numbers. They win on conflict.
2. `docs/plan/design-decisions.md`: the decision log DD-01 … It records how the specs and the owner's answers were turned into build decisions, and amends everything below.
3. `docs/technical/*`: how the code is built (architecture and stack, frontend, testing and CI). Keep it in step with the code; read-only unless your task says otherwise.

The work is tracked as GitHub issues of `wemaketools/claimsiq` under the Stage A and Stage B epics; the issue's `## Done` list is what "finished" means.

## Stack

- Bun (version pinned in `.bun-version` and `packageManager`) is the package manager and script runner: `bun install` with the committed `bun.lock`, `bun run <script>`, `bunx <cli>`, `bun <file.ts>` for scripts. Never use npm, npx or `node <file>`. TypeScript ~6 strict ESM, Bun workspaces: the SPA in `src/ui` (`@claimsiq/ui`) and the Playwright suite in `e2e_tests` (`@claimsiq/e2e`). Vitest is the test runner (not `bun test`).
- SPA: React 18.3, Vite 8, Redux Toolkit 2, React Router 7, recharts 3, zod 4, supabase-js 2 (authentication only), Vitest + React Testing Library + jest-dom, Playwright + axe.
- Backend (Stage B, in progress): the database exists (plain SQL migrations in `supabase/migrations`, Kysely over Supabase Postgres, row level security per tenant); the Hono API on Vercel functions comes next. `src/server/lib` holds the platform modules (`config`, `supabase`, `auth/verify.ts`) and the data layer (`db`, `tenancy`).
- Supabase CLI as a devDependency; the local Docker stack provides Auth, the Postgres database (`DATABASE_URL`) and Mailpit for reset emails. Ports are the CLI defaults plus 100 (API 54421, Postgres 54422, Studio 54423, Mailpit 54424).
- The design system is copied from TenderIQ with `--tiq-*` renamed to `--ciq-*` and `.tiq-*` to `.ciq-*`; every palette hex value is kept so the suite reads as one product family.

## Delivery stage

**Stage B (current, started):** the real backend, local and in CI, then the P1 features (epic #13). The database is built (schema, migrations, tenant isolation, the fixture seed); the Hono API, the real-API transport and the server-side demo sign-in follow. The hosted prototype stays the static Stage A build. Stage A below is the baseline that Stage B must keep identical.

**Stage A (complete):** the P0 proof of concept on the spec's synthetic fixtures. SPA, typed zod contracts, a mock API over versioned fixtures, a rules engine (`src/rules`, served by `claims.facts`), mutations (tasks, status) kept in browser storage until Reset. Sign-in is real against the local Supabase stack, except in prototype builds (the hosted demo: a role click, no Supabase); the persona switch is a view and not authentication. No AI features, no P1 (CLM-FR-19/20).

## Rules for every agent

- **Scope:** do what the issue's `## Done` list says. Something else you notice becomes a new issue or a line in your report, not an extra change.
- **No placeholders:** no TODO/FIXME, lorem ipsum, "coming soon", dead buttons or no-op handlers. Everything you define is complete, with loading, empty and error states (and a restricted state wherever a view can be limited by persona), and tests.
- **Supabase stack:** never reset or modify it except through the package scripts `supabase:start`, `supabase:stop`, `auth:personas`, `db:migrate`, `db:reset` and `db:seed`. `db:reset` and `db:seed` refuse a database that is not the local stack.
- **Ports:** the dev server uses 5273 and preview 4273; Playwright starts its own server on 5380 (`WEB_PORT`). Stop every server you start.
- **Scratch files** go under `.qa-scratch/<label>/` (git-ignored). Never write report or summary files into the repository.
- **Comments:** only a trap, an outside fact or a deliberate choice that looks wrong. No issue numbers in code comments; the commit message carries them.

## Code conventions

- **TypeScript strict, ESM.** No `any` (lint error). `import type` for type-only imports. Backend, contracts, mock API and scripts use NodeNext resolution: relative imports carry explicit `.js` extensions.
- **Zod v4** at every boundary (HTTP input, config, fixtures).
- **Configuration:** only `src/server/lib/config/index.ts` reads `process.env` (lint-enforced). Everything else calls `getConfig()`/`loadConfig()`.
- **Data rules from the specs** (CL §9, SF §5): money is BWP, decimal-safe, never a float sum; the as-of date defaults to 2026-10-21 (the owner can switch it in the shell) and every instant is Africa/Gaborone (+02:00); missing evidence is UNKNOWN, not good or bad; "fraud" is never implied: use "review indicator" or "exception"; every state change shows actor and time.
- **Boundaries (lint-enforced):** the SPA never imports `src/server`; only `src/ui/src/auth/**` imports `@supabase/supabase-js` (type imports excepted); `src/server` and `api/` never import the mock API; in the SPA only `src/ui/src/api/mockTransport.ts` (and tests) import it, screens call the typed endpoints; `src/contracts` is pure TypeScript + zod (+ decimal.js for money); `src/rules` (the claims rules engine) is pure too and imports only zod, decimal.js and `src/contracts`; `src/mock-api` takes no Node module outside its tests and `test-support`.
- **Database (DD-49 to DD-53):** the schema is plain SQL migrations in `supabase/migrations` (a new file per change, then `bun run db:types`). From the moment `stage-b` is pushed: a pushed migration is never edited, and a new one is named after the last (its timestamp sorts last). Every tenant table is keyed `(tenant_id, <entity>_id)`, references its parents with the tenant, and calls `enable_tenant_isolation`. Tenant data is read and written only inside `withTenant` (`src/server/lib/db/tenant.ts`), which runs as the RLS-bound role `claimsiq_app` with scope helpers that add the tenant predicate; a tenant id comes from `resolveTenantAccess`, never from a header directly. Money is `numeric(18,2)` and reaches TypeScript as a string.
- **Logging:** no `console.log` (only `console.warn`/`console.error`); scripts print with `process.stdout.write`. Never log tokens, keys, passwords or personal data.
- **SPA:** only the design system (`src/ui/src/theme`, `src/ui/src/components`): tokens, no raw hex, no literal pixel gaps. Every UI string goes through `t()`; each feature keeps its strings in `features/<feature>/i18n/en.ts`. A feature adds `features/<feature>/routes.tsx` and never edits a shared SPA file: the router and the sidebar build themselves from the registry.
- **SPA formatting and lint:** Prettier (`src/ui/.prettierrc`) is checked by `bun run lint:ui`, and ESLint warnings fail the lint (`--max-warnings 0`). Format with `bun run format:ui`. The react-hooks preset includes the React Compiler rules (no synchronous `setState` in an effect body, no impure calls such as `Date.now()` during render).
- **Fewer, broader tests (owner's rule):** tests are there to catch regressions and bugs in the real app, not to be exhaustively specific. Prefer one test that sets up once and walks a realistic flow with several assertions over many tests that each set up and tear down to check one or two things. Consolidate when you touch an area; a falling test count is fine, and the CI count floors are lowered to match.
- **Tests:** names state behavior, condition and outcome (AAA). Deterministic and order-independent. Root Vitest project `unit` covers `src/server/tests/unit`, `src/contracts`, `src/mock-api`, `src/rules` and `scripts`; SPA tests are colocated `*.test.ts(x)` under `src/ui/src` (jsdom, RTL, jest-dom; setup `src/ui/src/test/setup.ts`). The unit tests that verify real tokens, and the database tests (`scripts/db/*.test.ts`, on scratch databases of the local Postgres), skip themselves when the local stack is not running or `DATABASE_URL` is unset; CI starts the stack and fails on a skip.

## Commands

| Command | What it does |
|---|---|
| `bun run supabase:start` / `supabase:stop` / `supabase:status` | Local Supabase stack in Docker (generates the git-ignored ES256 signing key first) |
| `bun run auth:personas` | Creates or updates the four demo accounts in local Supabase Auth (password `test1234`, local only) |
| `bun run db:migrate` / `db:reset` / `db:seed` / `db:types` | Apply the migrations / rebuild the local database (migrations, demo accounts, seed) / reseed TEST and DEMO from `fixtures/v1` / regenerate the Kysely types after a migration |
| `bun run dev` | The SPA on http://localhost:5273 (needs `.env.local`; `run.ps1` writes it) |
| `bun run dev:prototype` / `build:prototype` | The same in prototype mode (`VITE_AUTH_MODE=prototype`): sign in by clicking a role, no Supabase, no env; Vercel builds this way |
| `bun run typecheck` / `typecheck:ui` | Backend, scripts and root config / SPA |
| `bun run lint` / `lint:ui` / `format:ui` | Backend lint / SPA lint + Prettier check / SPA Prettier write |
| `bun run test` / `test:unit` / `test:ui` | All root projects / root unit project / SPA suite |
| `bun run ci:test:ui` / `ci:test:unit` | The suites with the skip and count-floor assertions |
| `bun run build:ui` / `build` | SPA production build / backend typecheck + SPA build (Vercel's build command) |
| `bun run ci:security` | Secret scan of tracked files + production bundle leak scan |
| `bun run test:e2e` / `test:e2e:prototype` | Playwright (starts its own Vite on 5380 and a prototype preview on 5381; the first project needs the stack and the demo accounts) |
| `bun run verify` | typecheck → typecheck:ui → lint → lint:ui → test → test:ui → build:ui |

Local services: Supabase API http://127.0.0.1:54421, Studio http://127.0.0.1:54423, Mailpit http://127.0.0.1:54424. Setup and the sign-in walkthrough: `README.md`.
