# Testing and CI

Status: as built (scaffold, data layer and rules engine). The decisions behind it (CI and checks, Bun) are in `docs/plan/design-decisions.md`.

## Test projects

| Project | Where | Runner and environment | Command |
|---|---|---|---|
| Root `unit` | `src/server/tests/unit`, `src/contracts/**`, `src/mock-api/**`, `src/rules/**`, `scripts/**/*.test.ts` | Vitest, node environment, 20 s timeout | `bun run test:unit` |
| Root `integration` | `src/server/tests/integration` (does not exist yet; `passWithNoTests` is on until it does) | Vitest, serial, 180 s timeouts | `vitest run --project integration` |
| SPA | colocated `src/ui/src/**/*.test.ts(x)` | Vitest, jsdom, React Testing Library, jest-dom; setup `src/ui/src/test/setup.ts` | `bun run test:ui` |
| E2E | `e2e_tests/specs` | Playwright + `@axe-core/playwright`, Chromium, 1440×900 | `bun run test:e2e` |

`bun run test` runs both root projects. Vitest is the runner everywhere; `bun test` is not used. Root tests see the values of the git-ignored `.env.local` (`vitest.config.ts` parses it), so they behave like the scripts.

Conventions: fewer, broader tests. A test sets up once and walks a realistic flow with several assertions (sign in, walk the pages, switch persona and theme, reload) instead of many tests that each check one or two things; a test names the behavior it protects, and assertions that only pin a constant or a class name are left out. Tests are deterministic and order-independent. Helpers for the SPA are in `src/ui/src/test`:

- `renderWithProviders(element, options)`: the element in the store, a stub auth context, toasts and a memory data router, with the API client adapters wired to the store.
- `renderRouteTree(routes, options)`: the same providers around a whole route tree, for example the application's own (`buildRoutes`); `renderWithProviders` is built on it.
- `restoreAfterEach(restore)`: registers the restore function returned by `configureApiClient` or `configureScreenLoader` to run after the current test, so no test leaks global state.
- `installFetch`: route-keyed `fetch` stub that records requests.
- `signedInSession` / `signedOutSession`: session states for a preloaded store.
- `renderRouteTree` and `renderWithProviders` take a `transport`, so a test can send API calls to the real mock API (`createMockTransport()` over `localStorage`) or to a canned answer.
- `readSourceFile`: reads a stylesheet for the contract in `theme/components.test.ts`, which asserts the few layout and accessibility rules jsdom cannot measure.

## Data-layer tests

`src/contracts/contracts.test.ts` (the 17 entities and their keys, endpoint ids, decimal money, times), `src/mock-api/fixtures/load.test.ts` (TEST 6 claims and 6 invoices, DEMO 30 and 36, no mixing, TEST reconciles to `expected_metrics.json`; a fixture with bad rows is quarantined with row, field, problem and fix and the good rows load) and `src/mock-api/api.test.ts` (tenant filtering, as-of reads, create task, refresh over the same storage, Reset). Their helpers are in `src/mock-api/test-support` (they read `fixtures/v1` from disk). The SPA side is `components/shell/dataControls.test.tsx`.

## Rules-engine tests

`src/rules/rules.test.ts` runs the engine on the real TEST fixture through the loader and the as-of view: the figures of `expected_metrics.json`, every worked case of the requirements (CLM-101 to CLM-106, including CLM-106 high value with a supplier delay) and the mock API's `claims.facts` answer; a rule-config test that changes thresholds and sees the results move (and refuses a config it cannot honour); a missing-evidence test (unknown SLA, unverified supplier request, payment statuses, event order and tie-break, reserve fallback, business-day and age-bucket boundaries); and the money format.

## The local-stack skip

`src/server/tests/unit/platform-auth/verify.local-stack.test.ts` verifies tokens issued by the real local Supabase Auth against its JWKS. It probes `<SUPABASE_URL>/auth/v1/health` once at load and skips the whole file when `.env.local` is missing or the stack does not answer, so `bun run test` passes on a machine without Docker (1 test skipped). CI starts the stack first, so there they run. Because skipped tests hide regressions, CI never runs the unit project through the skip assertion; it relies on the stack step failing first.

## Count floors

`bun run ci:test:ui` and `ci:test:unit` write a Vitest JSON report and run `scripts/ci/assert-test-run.ts`, which fails when the run did not succeed, when any test failed or was skipped, or when fewer than `--min-tests` tests ran (it catches silently dropped suites). The floors in `package.json` are sized to what exists: SPA 43, unit 23 (the number of unit tests that run with the stack up). Raise them in the same change that adds tests. `ci:test:unit` also fails on the skipped local-stack test, so it is only meaningful where the stack is up; CI runs `test:unit` for that reason and `ci:test:ui` for the SPA.

## End-to-end

`e2e_tests/playwright.config.ts` starts Vite itself on `WEB_PORT` (default 5380, strict port, never reusing a server) with the root `.env.local`. `specs/shell.spec.ts` has two flows against the real local stack: the signed-out one (redirect to sign-in, the sign-in page, a wrong password) and the signed-in one (a seeded demo account signs in, walks the six destinations and their empty states, switches persona and theme and keeps them across a reload, and signs out). It runs axe (WCAG 2.0/2.1 A and AA) on the sign-in page, the signed-in shell and the shell after a reload; any violation fails the test.

Prerequisites: Docker running, `bun run supabase:start`, `.env.local` written, `bun run auth:personas`, and the browser once with `bunx playwright install chromium` (from `e2e_tests`).

## Security scans

`bun run ci:security` runs two scans. `scan-secrets` checks every file git would commit for JWT-shaped strings, Supabase secret keys, private keys and connection URLs with an inline password. `scan-bundle` builds the SPA and fails when `src/ui/dist` contains demo-account e-mails or mock-api source paths (the in-browser mock API itself ships in Stage A), `src/server` code, a server-only variable name, a service-role key, the marker of the development-only demo-accounts quick-pick, or a production Content-Security-Policy with development relaxations.

## CI

`.github/workflows/ci.yml` has one `verify` job on every push and pull request: set up Bun from `.bun-version`, `bun install --frozen-lockfile`, print tool versions, start the local Supabase stack, write a throwaway `.env.local` from `supabase status`, seed the demo accounts, then typecheck, typecheck the SPA, lint, lint the SPA (with Prettier), unit tests, SPA tests with the floor, the production build, the security scans, install Chromium, run Playwright, upload the Playwright report on failure and stop the stack. Runs on one ref cancel older ones, except on `main` and `dev`.

`bun run verify` is the local equivalent of the non-browser steps: typecheck, typecheck:ui, lint, lint:ui, test, test:ui, build:ui.
