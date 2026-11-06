# ClaimsIQ

**Claims Intelligence**: the claims control tower of The Brittany insurance intelligence suite. It shows a claims manager what is open, old, high-value or outside service levels, which suppliers hold claims up, and what to chase today. It reads as one suite with TenderIQ and QuoteIQ and shares their design system.

## Status: Stage A complete, Stage B in progress

Stage A builds the P0 requirements of `ai/specs` on the specs' synthetic TEST and DEMO data, and is complete: the stack, the design system, the app shell, real sign-in against a local Supabase stack (or a role click in the hosted prototype), the persona switch, CI, the typed in-browser mock API over the fixtures, the rules engine, and all six screens of the shell (Overview, Stages & Aging, Exceptions & SLA, Claims, Suppliers, Action Queue) plus Claim Detail and the policy invoices, each with its loading, empty and error states. Stage B adds the real backend: the local Supabase stack also holds the database (schema, tenant isolation and the fixture seed, see "The local database") and a Hono API serves every screen from it (see "The API"). Signed in against the local stack, the app reads and writes the database through the API and what you change (tasks, assignments, status, the audit trail) is kept there until Reset; the hosted prototype build is unchanged and still runs on the in-browser mock API, with changes kept in the browser.

- `docs/acceptance.md`: the spec's 16 acceptance tests (CLM-AT-01 to 16), where each is asserted and the result.
- `docs/demo-script.md`: the 7 to 9 minute Head of Claims demo, step by step, for the hosted prototype.
- `CLAUDE.md`: the order of truth and the rules; `docs/plan/design-decisions.md`: the decisions.

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
# put the API_URL, DB_URL, ANON_KEY and SERVICE_ROLE_KEY of `bunx supabase status -o env` into .env.local
# (SUPABASE_URL and VITE_SUPABASE_URL = API_URL, DATABASE_URL = DB_URL, SUPABASE_ANON_KEY and VITE_SUPABASE_ANON_KEY
# = ANON_KEY, SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY)
bun run db:reset              # build the local database: migrations, demo accounts, TEST and DEMO seed
# (or, for the demo accounts alone: bun run auth:personas)
bun run dev                   # the API on http://127.0.0.1:5274 and the SPA on http://localhost:5273
```

Open http://localhost:5273 and sign in. In local development builds the sign-in page lists the demo accounts for one-click sign-in (the list never exists in production builds). Stop the stack with `bun run supabase:stop`.

If you only want to look at the app, skip Supabase and `.env.local`: `bun run dev:prototype` runs the same app with a role click instead of a password (see "Prototype mode" below).

### Local services

| Service | Address |
|---|---|
| SPA (Vite) | http://localhost:5273 (proxies `/api` to the API) |
| API (Hono) | http://127.0.0.1:5274/api/v1 (health: `/api/v1/health`) |
| Supabase API gateway (Auth) | http://127.0.0.1:54421 |
| Postgres | 127.0.0.1:54422 (the application schema, `DATABASE_URL`) |
| Supabase Studio | http://127.0.0.1:54423 |
| Mailpit (password-reset emails) | http://127.0.0.1:54424 (SMTP 54425) |

The ports are the Supabase defaults plus 100, so the stack runs beside another project's default one.

### The local database

The schema is plain SQL in `supabase/migrations`. The tables are keyed `(tenant_id, id)` and TEST and DEMO are two tenants of one database; row level security keeps a tenant's session away from the other's rows.

| Command | What it does |
|---|---|
| `bun run db:migrate` | Applies the migrations the local database has not seen (`supabase migration up --local`) |
| `bun run db:reset` | Rebuilds the local database from empty: all migrations, the demo accounts (`auth:personas`), then the seed. Refuses any database that is not the local stack |
| `bun run db:seed` | Replaces the TEST and DEMO rows from `fixtures/v1` through the fixture loader and links the four demo accounts to both tenants. Prints the row counts and every quarantined row. `-- --data-set TEST` seeds one |
| `bun run db:types` | Regenerates the Kysely table types (`src/server/lib/db/generated/schema.ts`) after a migration |

A new migration is a new file in `supabase/migrations` (never an edit of an applied one), then `bun run db:migrate` and `bun run db:types`.

### The API

`bun run dev` starts the API server and the SPA together (Ctrl+C stops both). `bun run dev:api` starts the API alone and `bun run dev:ui` the SPA alone; `dev:prototype` needs neither the stack nor the API. The API is the Hono app that Vercel serves as one function (`api/v1/index.ts`), here over `node:http` on `API_PORT` (default 5274); the Vite dev server proxies `/api` to it, so the SPA calls `/api/v1` on its own origin.

Every endpoint of `src/contracts/endpoints.ts` is served from the database. A request needs `Authorization: Bearer <the Supabase access token>` (401 without a valid session) and `X-Tenant-Id` naming a tenant the account is a member of (403 otherwise, checked on every request); `X-As-Of` and `X-Persona` carry the as-of date and the persona acting. The rules engine runs on the server, over the same shared read model as the mock API (`src/read-model`). To call it by hand:

```bash
TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $SUPABASE_ANON_KEY" \
  -H 'content-type: application/json' -d '{"email":"head.of.claims@claimsiq.local","password":"'"${DEMO_SEED_PASSWORD:-test1234}"'"}' | jq -r .access_token)
curl -s localhost:5274/api/v1/claim-facts -H "Authorization: Bearer $TOKEN" -H 'X-Tenant-Id: TEST' | jq .summary.totals
```

**Reset** in the app restores the selected data set in the database from the committed fixture (rows, rules, tasks and their audit trail). It works only when `APP_ENV` is `local` or `dev`; anywhere else the API refuses it with 403.

### Demo accounts

There is one account per persona. Locally they all have the password **`test1234`**, unless `DEMO_SEED_PASSWORD` is set in `.env.local`; `bun run auth:personas` gives the accounts that password. On the sign-in page, a click on a demo role signs in through the server (`POST /api/v1/auth/demo-sign-in`, which takes only the e-mail and uses the password from the server's own environment), so the page holds no password. If the server has none (any hosted environment without `DEMO_SEED_PASSWORD`) or refuses, the e-mail is filled into the form instead. The accounts:

| Account | Persona |
|---|---|
| `head.of.claims@claimsiq.local` | Head of Claims |
| `claims.handler@claimsiq.local` | Claims Handler |
| `supplier.coordinator@claimsiq.local` | Supplier Coordinator |
| `finance@claimsiq.local` | Finance |

The account only signs you in. The **Viewing as** switch in the top bar chooses the persona the shell shows; it is a demo convenience and not authentication, and it is remembered in the browser.

### The data controls

The top bar carries the controls that decide which figures you see, and they are remembered in the browser:

| Control | What it does |
|---|---|
| **Data set** | `TEST` is the spec's golden set (6 claims, 5 open, P9,000 paid, P68,000 reserve, P77,000 incurred); `DEMO` is the 30-claim fictional insurer. The app opens on DEMO. The two never mix. |
| **As of** | The snapshot date (21 Oct 2026 by default). Every figure, age and service-level count is derived at this date. |
| **Data issues (n)** | Lists rows the loader left out or flagged, each with its file, row, field, problem and fix. |
| **Reset** | Asks to confirm, then removes the tasks and status changes you made on the selected data set (in the database through the API, or in the browser in a prototype build); the fixture shows exactly as loaded. The data set and the as-of date stay. |

## Prototype mode and the hosted demo

A **prototype build** is a static demo: no Supabase, no passwords, no environment variables. The sign-in page lists the four demo roles, a click signs in as that role, every screen runs on the in-browser mock API over the synthetic fixtures, and every page shows the banner "Prototype: synthetic demo data". The mode is chosen when the app is built, by `VITE_AUTH_MODE=prototype`.

```bash
bun run dev:prototype      # the SPA on http://localhost:5273 in prototype mode (no stack, no .env.local)
bun run build:prototype    # the static build in src/ui/dist
```

`bun run dev` and `bun run build` (no mode) keep real Supabase sign-in against the local stack. A production build with neither `VITE_AUTH_MODE` nor the `VITE_SUPABASE_*` variables stops with an error that names both ways out, so a deploy never ships a page that cannot sign anyone in.

### Deploy the demo (Kwaku)

1. In Vercel choose **Add New, Project**, import this repository and pick the branch to deploy. Leave the framework (Vite), install command, build command and output directory as the project detects them from `vercel.json`.
2. Do not add any environment variable. `vercel.json` already sets what the build needs: it installs with `bun install --frozen-lockfile`, builds with `VITE_AUTH_MODE=prototype bun run build` (typecheck, then the SPA in prototype mode), serves `src/ui/dist`, and rewrites every other path to `index.html`, so a link such as `/claims/DCLM-002` (a claim in the DEMO data set the prototype opens on) opens directly. The deploy has no function either: `.vercelignore` leaves `api/` out, because the API ships only once a hosted database exists (DD-59).
3. Deploy. Open the URL, click a role: it lands on Overview under the banner.

The deployed site is static files only. It calls no server, and the data it shows is synthetic. What a visitor changes (tasks, status) stays in their own browser until **Reset**. To check a build before deploying: `bun run build:prototype`, then `bun run --filter @claimsiq/ui preview` and open http://localhost:4273.

## Checks

`bun run verify` runs the typecheck, lint, unit tests, SPA tests and the production build. `bun run test:e2e` runs the Playwright suite (the local-stack project needs the stack and the built database, and starts its own API and Vite; the prototype project, `bun run test:e2e:prototype`, builds and serves a prototype production build and needs neither). The prototype project holds the acceptance spec, `e2e_tests/specs/acceptance.spec.ts`, with a step for each of CLM-AT-01 to 16 (`docs/acceptance.md`). Install the browser once with `bunx playwright install chromium` from `e2e_tests`. `bun run ci:security` scans for secrets and for server code in the production bundle, and for supabase-js in a prototype build. All commands are listed in `CLAUDE.md`.
