# Testing and CI

Status: as built (scaffold). The decisions behind it (CI and checks, Bun) are in `docs/plan/design-decisions.md`.

## Test projects

| Project | Where | Runner and environment | Command |
|---|---|---|---|
| Root `unit` | `src/server/tests/unit`, `src/contracts/**`, `src/mock-api/**`, `scripts/**/*.test.ts` | Vitest, node environment, 20 s timeout | `bun run test:unit` |
| Root `integration` | `src/server/tests/integration` (does not exist yet; `passWithNoTests` is on until it does) | Vitest, serial, 180 s timeouts | `vitest run --project integration` |
| SPA | colocated `src/ui/src/**/*.test.ts(x)` | Vitest, jsdom, React Testing Library, jest-dom; setup `src/ui/src/test/setup.ts` | `bun run test:ui` |
| E2E | `e2e_tests/specs` | Playwright + `@axe-core/playwright`, Chromium, 1440×900 | `bun run test:e2e` |

`bun run test` runs both root projects. Vitest is the runner everywhere; `bun test` is not used. Root tests see the values of the git-ignored `.env.local` (`vitest.config.ts` parses it), so they behave like the scripts.

Conventions: test names state behavior, condition and outcome; AAA; deterministic and order-independent. Helpers for the SPA are in `src/ui/src/test`: `renderWithProviders` (store, stub auth, toasts, memory data router), `installFetch` (route-keyed `fetch` stub that records requests), `signedInSession` / `signedOutSession`, `readSourceFile` (reads a stylesheet for the contract tests in `theme/components.test.ts`, which assert layout and accessibility rules jsdom cannot measure).

## The local-stack skip

`src/server/tests/unit/platform-auth/verify.local-stack.test.ts` verifies tokens issued by the real local Supabase Auth against its JWKS. It probes `<SUPABASE_URL>/auth/v1/health` once at load and skips the whole file when `.env.local` is missing or the stack does not answer, so `bun run test` passes on a machine without Docker (8 tests skipped). CI starts the stack first, so there they run. Because skipped tests hide regressions, CI never runs the unit project through the skip assertion; it relies on the stack step failing first.

## Count floors

`bun run ci:test:ui` and `ci:test:unit` write a Vitest JSON report and run `scripts/ci/assert-test-run.ts`, which fails when the run did not succeed, when any test failed or was skipped, or when fewer than `--min-tests` tests ran (it catches silently dropped suites). The floors in `package.json` are sized to what exists: SPA 182, unit 64. Raise them in the same change that adds tests. `ci:test:unit` also fails on the 8 local-stack skips, so it is only meaningful where the stack is up; CI runs `test:unit` for that reason and `ci:test:ui` for the SPA.

## End-to-end

`e2e_tests/playwright.config.ts` starts Vite itself on `WEB_PORT` (default 5380, strict port, never reusing a server) with the root `.env.local`. `specs/shell.spec.ts` signs in with the seeded demo accounts against the real local stack and covers the sign-in page, a wrong password, the six destinations and their empty states, the persona switch and theme surviving a reload, sign-out and the redirect of a signed-out visitor. It runs axe (WCAG 2.0/2.1 A and AA) on the sign-in page, the signed-in shell and the shell after a reload; any violation fails the test.

Prerequisites: Docker running, `bun run supabase:start`, `.env.local` written, `bun run auth:personas`, and the browser once with `bunx playwright install chromium` (from `e2e_tests`).

## Security scans

`bun run ci:security` runs two scans. `scan-secrets` checks every file git would commit for JWT-shaped strings, Supabase secret keys, private keys and connection URLs with an inline password. `scan-bundle` builds the SPA and fails when `src/ui/dist` contains mock-API code or demo-account e-mails, `src/server` code, a server-only variable name, a service-role key, the marker of the development-only demo-accounts quick-pick, or a production Content-Security-Policy with development relaxations.

## CI

`.github/workflows/ci.yml` has one `verify` job on every push and pull request: set up Bun from `.bun-version`, `bun install --frozen-lockfile`, print tool versions, start the local Supabase stack, write a throwaway `.env.local` from `supabase status`, seed the demo accounts, then typecheck, typecheck the SPA, lint, lint the SPA (with Prettier), unit tests, SPA tests with the floor, the production build, the security scans, install Chromium, run Playwright, upload the Playwright report on failure and stop the stack. Runs on one ref cancel older ones, except on `main` and `dev`.

`bun run verify` is the local equivalent of the non-browser steps: typecheck, typecheck:ui, lint, lint:ui, test, test:ui, build:ui.
