# ClaimsIQ

**Claims Intelligence**: the claims control tower of The Brittany insurance intelligence suite. It shows a claims manager what is open, old, high-value or outside service levels, which suppliers hold claims up, and what to chase today. It reads as one suite with TenderIQ and QuoteIQ and shares their design system.

## Status: Stage A, proof of concept

Stage A builds the P0 requirements of `ai/specs` on the specs' synthetic TEST and DEMO data. Today the repository contains the stack, the design system, the app shell, real sign-in against a local Supabase stack, the persona switch, CI, the typed in-browser mock API over the fixtures, the rules engine, and all six screens of the shell (Overview, Stages & Aging, Exceptions & SLA, Claims, Suppliers, Action Queue) plus Claim Detail and the policy invoices, each with its loading, empty and error states. See `CLAUDE.md` for the order of truth and the rules, and `docs/plan/design-decisions.md` for the decisions.

## Prerequisites

- **Bun** (the version in `.bun-version`), from https://bun.sh
- **Docker Desktop**, running (for the local Supabase stack)
- Windows, macOS or Linux. `run.ps1` is a one-command runner for Windows.

The Supabase CLI is a pinned dev dependency; nothing else needs a global install.

## Local development

On Windows, one command does everything below: `.\run.ps1`

Step by step:

```bash
bun install
bun run supabase:start        # local Supabase stack in Docker (first run downloads the images)
cp .env.local.example .env.local
# put the API_URL, ANON_KEY and SERVICE_ROLE_KEY of `bunx supabase status -o env` into .env.local
# (SUPABASE_URL and VITE_SUPABASE_URL = API_URL, SUPABASE_ANON_KEY and VITE_SUPABASE_ANON_KEY = ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY)
bun run auth:personas         # create the demo accounts in local Supabase Auth
bun run dev                   # the SPA on http://localhost:5273
```

Open http://localhost:5273 and sign in. In local development builds the sign-in page lists the demo accounts for one-click sign-in (the list never exists in production builds). Stop the stack with `bun run supabase:stop`.

### Local services

| Service | Address |
|---|---|
| SPA (Vite) | http://localhost:5273 |
| Supabase API gateway (Auth) | http://127.0.0.1:54421 |
| Postgres | 127.0.0.1:54422 (no application schema yet) |
| Supabase Studio | http://127.0.0.1:54423 |
| Mailpit (password-reset emails) | http://127.0.0.1:54424 (SMTP 54425) |

The ports are the Supabase defaults plus 100, so the stack runs beside another project's default one.

### Demo accounts

Every account uses the password **`test1234`** (local only). There is one per persona:

| Account | Persona |
|---|---|
| `head.of.claims@claimsiq.local` | Head of Claims |
| `claims.handler@claimsiq.local` | Claims Handler |
| `supplier.coordinator@claimsiq.local` | Supplier Coordinator |
| `finance@claimsiq.local` | Finance |

The account only signs you in. The **Viewing as** switch in the top bar chooses the persona the shell shows; it is a demo convenience and not authentication, and it is remembered in the browser.

## Prototype mode and the hosted demo

A **prototype build** is a static demo: no Supabase, no passwords, no environment variables. The sign-in page lists the four demo roles, a click signs in as that role, every screen runs on the in-browser mock API over the synthetic fixtures, and every page shows the banner "Prototype: synthetic demo data". The mode is chosen when the app is built, by `VITE_AUTH_MODE=prototype`.

```bash
bun run dev:prototype      # the SPA on http://localhost:5273 in prototype mode (no stack, no .env.local)
bun run build:prototype    # the static build in src/ui/dist
```

`bun run dev` and `bun run build` (no mode) keep real Supabase sign-in against the local stack. A production build with neither `VITE_AUTH_MODE` nor the `VITE_SUPABASE_*` variables stops with an error that names both ways out, so a deploy never ships a page that cannot sign anyone in.

### Deploy the demo (Kwaku)

1. In Vercel choose **Add New, Project**, import this repository and pick the branch to deploy. Leave the framework (Vite), install command, build command and output directory as the project detects them from `vercel.json`.
2. Do not add any environment variable. `vercel.json` already sets what the build needs: it installs with `bun install --frozen-lockfile`, builds with `VITE_AUTH_MODE=prototype bun run build` (typecheck, then the SPA in prototype mode), serves `src/ui/dist`, and rewrites every other path to `index.html`, so a link such as `/claims/CLM-101` opens directly.
3. Deploy. Open the URL, click a role: it lands on Overview under the banner.

The deployed site is static files only. It calls no server, and the data it shows is synthetic. What a visitor changes (tasks, status) stays in their own browser until **Reset**. To check a build before deploying: `bun run build:prototype`, then `bun run --filter @claimsiq/ui preview` and open http://localhost:4273.

## Checks

`bun run verify` runs the typecheck, lint, unit tests, SPA tests and the production build. `bun run test:e2e` runs the Playwright suite (the local-stack project needs the stack and the demo accounts; the prototype project, `bun run test:e2e:prototype`, builds and serves a prototype production build and needs neither). `bun run ci:security` scans for secrets and for server code in the production bundle, and for supabase-js in a prototype build. All commands are listed in `CLAUDE.md`.
