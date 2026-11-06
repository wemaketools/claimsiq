To ask the owner for a settings change, use `converse permit` and make the change only when their confirmed answer reaches you.

# ClaimsIQ: instructions for agents

ClaimsIQ ("Claims Intelligence") is the claims control tower of The Brittany insurance intelligence suite, built to read as one suite with TenderIQ and QuoteIQ. TypeScript everywhere, React 18 SPA on Vite, Supabase Auth for sign-in, Hono API on Vercel functions later.

## Where the truth lives

Read before writing anything, in this order of precedence:

1. `ai/specs/`: the product specifications (the Complete Insurance Intelligence Build Pack, the editable Word sources `01_Shared_Foundation`, `03_ClaimsIQ_Requirements`, the synthetic TEST and DEMO data with `expected_metrics.json`, the Commercial Product Pulse). They define screens (CLM-01 to 06), requirements (CLM-FR-xx), rules, acceptance tests (CLM-AT-xx) and the numbers. They win on conflict.
2. `docs/plan/design-decisions.md`: the decision log DD-01 … It records how the specs and the owner's answers were turned into build decisions, and amends everything below.
3. `docs/technical/*`: how the code is built (architecture and stack, frontend, testing and CI). Keep it in step with the code; read-only unless your task says otherwise.

The work is tracked as GitHub issues of `wemaketools/claimsiq` under the Stage A epic; the issue's `## Done` list is what "finished" means.

## Stack

- Bun (version pinned in `.bun-version` and `packageManager`) is the package manager and script runner: `bun install` with the committed `bun.lock`, `bun run <script>`, `bunx <cli>`, `bun <file.ts>` for scripts. Never use npm, npx or `node <file>`. TypeScript ~6 strict ESM, Bun workspaces: the SPA in `src/ui` (`@claimsiq/ui`) and the Playwright suite in `e2e_tests` (`@claimsiq/e2e`). Vitest is the test runner (not `bun test`).
- SPA: React 18.3, Vite 8, Redux Toolkit 2, React Router 7, recharts 3, zod 4, supabase-js 2 (authentication only), Vitest + React Testing Library + jest-dom, Playwright + axe.
- Backend (planned, not built yet): Hono on Vercel functions, Kysely over Supabase Postgres. Today `src/server/lib` holds only the platform modules (`config`, `supabase`, `auth/verify.ts`).
- Supabase CLI as a devDependency; the local Docker stack provides Auth (and Mailpit for reset emails). Ports are the CLI defaults plus 100 (API 54421, Postgres 54422, Studio 54423, Mailpit 54424).
- The design system is copied from TenderIQ with `--tiq-*` renamed to `--ciq-*` and `.tiq-*` to `.ciq-*`; every palette hex value is kept so the suite reads as one product family.

## Delivery stage

**Stage A (current):** the P0 proof of concept on the spec's synthetic fixtures. SPA, typed zod contracts, a mock API over versioned fixtures, a rules engine, mutations (tasks, status) kept in browser storage until Reset. Sign-in is real against the local Supabase stack; the persona switch is a view and not authentication. No AI features, no P1 (CLM-FR-19/20). A real database and API is a later epic and starts only with the owner's written approval.

## Rules for every agent

- **Scope:** do what the issue's `## Done` list says. Something else you notice becomes a new issue or a line in your report, not an extra change.
- **No placeholders:** no TODO/FIXME, lorem ipsum, "coming soon", dead buttons or no-op handlers. Everything you define is complete, with loading, empty and error states (and a restricted state wherever a view can be limited by persona), and tests.
- **Supabase stack:** never reset or modify it except through the package scripts `supabase:start`, `supabase:stop` and `auth:personas`.
- **Ports:** the dev server uses 5273 and preview 4273; Playwright starts its own server on 5380 (`WEB_PORT`). Stop every server you start.
- **Scratch files** go under `.qa-scratch/<label>/` (git-ignored). Never write report or summary files into the repository.
- **Comments:** only a trap, an outside fact or a deliberate choice that looks wrong. No issue numbers in code comments; the commit message carries them.

## Code conventions

- **TypeScript strict, ESM.** No `any` (lint error). `import type` for type-only imports. Backend, contracts, mock API and scripts use NodeNext resolution: relative imports carry explicit `.js` extensions.
- **Zod v4** at every boundary (HTTP input, config, fixtures).
- **Configuration:** only `src/server/lib/config/index.ts` reads `process.env` (lint-enforced). Everything else calls `getConfig()`/`loadConfig()`.
- **Data rules from the specs** (CL §9, SF §5): money is BWP, decimal-safe, never a float sum; the as-of date is fixed at 2026-10-21 and every instant is Africa/Gaborone (+02:00); missing evidence is UNKNOWN, not good or bad; "fraud" is never implied: use "review indicator" or "exception"; every state change shows actor and time.
- **Boundaries (lint-enforced):** the SPA never imports `src/server`; only `src/ui/src/auth/**` imports `@supabase/supabase-js` (type imports excepted); `src/server` and `api/` never import the mock API; `src/contracts` is pure TypeScript + zod.
- **Logging:** no `console.log` (only `console.warn`/`console.error`); scripts print with `process.stdout.write`. Never log tokens, keys, passwords or personal data.
- **SPA:** only the design system (`src/ui/src/theme`, `src/ui/src/components`): tokens, no raw hex, no literal pixel gaps. Every UI string goes through `t()`; each feature keeps its strings in `features/<feature>/i18n/en.ts`. A feature adds `features/<feature>/routes.tsx` and never edits a shared SPA file: the router and the sidebar build themselves from the registry.
- **SPA formatting and lint:** Prettier (`src/ui/.prettierrc`) is checked by `bun run lint:ui`, and ESLint warnings fail the lint (`--max-warnings 0`). Format with `bun run format:ui`. The react-hooks preset includes the React Compiler rules (no synchronous `setState` in an effect body, no impure calls such as `Date.now()` during render).
- **Tests:** names state behavior, condition and outcome (AAA). Deterministic and order-independent. Root Vitest project `unit` covers `src/server/tests/unit`, `src/contracts`, `src/mock-api` and `scripts`; SPA tests are colocated `*.test.ts(x)` under `src/ui/src` (jsdom, RTL, jest-dom; setup `src/ui/src/test/setup.ts`). The unit tests that verify real tokens skip themselves when the local stack is not running; CI starts it.

## Commands

| Command | What it does |
|---|---|
| `bun run supabase:start` / `supabase:stop` / `supabase:status` | Local Supabase stack in Docker (generates the git-ignored ES256 signing key first) |
| `bun run auth:personas` | Creates or updates the four demo accounts in local Supabase Auth (password `test1234`, local only) |
| `bun run dev` | The SPA on http://localhost:5273 (needs `.env.local`; `run.ps1` writes it) |
| `bun run typecheck` / `typecheck:ui` | Backend, scripts and root config / SPA |
| `bun run lint` / `lint:ui` / `format:ui` | Backend lint / SPA lint + Prettier check / SPA Prettier write |
| `bun run test` / `test:unit` / `test:ui` | All root projects / root unit project / SPA suite |
| `bun run ci:test:ui` / `ci:test:unit` | The suites with the skip and count-floor assertions |
| `bun run build:ui` / `build` | SPA production build / backend typecheck + SPA build (Vercel's build command) |
| `bun run ci:security` | Secret scan of tracked files + production bundle leak scan |
| `bun run test:e2e` | Playwright (starts its own Vite on 5380; needs the stack and the demo accounts) |
| `bun run verify` | typecheck → typecheck:ui → lint → lint:ui → test → test:ui → build:ui |

Local services: Supabase API http://127.0.0.1:54421, Studio http://127.0.0.1:54423, Mailpit http://127.0.0.1:54424. Setup and the sign-in walkthrough: `README.md`.
