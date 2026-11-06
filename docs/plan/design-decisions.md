# Design decisions

The decision log of the ClaimsIQ build. The product specifications in `ai/specs/` come first; this log records how they were turned into build decisions and amends the technical documents. A decision is never edited away: a changed decision is a new entry that says which one it replaces.

Format: `DD-nn`, the decision, then why.

## Scaffold (Stage A, item 1)

### DD-01 Standalone repository shaped like TenderIQ

ClaimsIQ is its own repository with the layout of the TenderIQ repository: `src/ui` (SPA), `src/server` (platform modules), `scripts`, `supabase`, `e2e_tests`, `docs`. The parts the specs want shared with the other products (contracts, fixtures and loader, rules, shell) get clearly separate folders, so they can move into a shared package once the link to Premium Collections is settled.

Why: the owner chose one codebase per product that reads as one suite; separate folders keep a later extraction cheap.

### DD-02 Same tool versions as TenderIQ

TypeScript ~6, Vite 8, React 18.3, Redux Toolkit 2, React Router 7, recharts 3, zod 4, Hono, Kysely, supabase-js 2, the Supabase CLI as a devDependency, Vitest with React Testing Library, Playwright in `e2e_tests`. Bun workspaces (DD-13): the UI is `src/ui` (package `@claimsiq/ui`), the Playwright suite is `e2e_tests` (`@claimsiq/e2e`). Hono, Kysely and `pg` are declared for the backend that comes later and are not imported yet.

Why: a developer or agent who knows one product knows all three; versions move together.

### DD-03 Prefix `ciq`, palette unchanged

Every `--tiq-*` token and `.tiq-*` class of the TenderIQ design system is `--ciq-*` / `.ciq-*` in ClaimsIQ. Every palette hex value is kept, including the AA-contrast `-text`, `accent-fill` and `on-solid` tokens. Components contain no raw hex values and no literal pixel gaps.

Why: the three products must read as one suite; only the prefix identifies the product. Keeping the AA tokens keeps the contrast guarantees.

### DD-04 Brand

The wordmark is `Claims` plus the accent `IQ` (`Claims<span class="ciq-brand-iq">IQ</span>`), the sub-brand is "Claims Intelligence", the collapsed rail shows `C` plus `IQ`. The favicon is a rounded square `#10808a` with a white "C", in the style of the TenderIQ favicon. The document title is `{page} · ClaimsIQ`.

### DD-05 What was copied and what was left out

Kept, because it is generic: the theme (tokens, components, global CSS), the `components/ui` library, the charts, the shell (AppShell, Sidebar, Topbar, UserCard), authentication (AuthProvider, sign-in, forgot and reset password, the development-only demo-accounts list), the app store, the route guard, the feature registry, the API client that sends `X-Tenant-Id`, the i18n file, the CSP meta tag, the self-hosted fonts with their OFL licences, `src/server/lib/{config,supabase,auth}`, the CI workflow and `scripts/ci`.

Left out: every tender-specific feature, route, contract, fixture and shared widget (approvals, documents, audit), the public portal and organization selection, the mock API server and the OpenAPI generator. Money formatting from decimal strings and the contracts-driven enum labels are not copied; they come back with the data layer.

### DD-06 Navigation: six destinations

The sidebar has, in this order: Overview (`/overview`), Stages & Aging (`/stages`), Exceptions & SLA (`/exceptions`), Claims (`/claims`), Suppliers (`/suppliers`), Action Queue (`/actions`). They map to CLM-01, CLM-02, CLM-03, the claims list with CLM-04 (Claim Detail) under it, CLM-05 and CLM-06 of the requirements. `/` goes to the first destination. The sidebar is a flat list (no collapsible sections, no badges, no section actions): six items do not need them.

Each destination is a feature module (`src/ui/src/features/<feature>`). Until the data layer exists, a page shows its title and one of three states through `useScreenStatus` and `ScreenStates`: loading, then an empty state, or an error state with retry when its loader fails. The screens that follow replace the page body with real content and drop the placeholder.

### DD-07 Persona switch is a view, stored in the browser

The persona switch offers Head of Claims, Claims Handler, Supplier Coordinator and Finance (CL §4). It is a **view** switch shown in the top bar ("Viewing as") and in the user card; it is not authentication and does not change what the signed-in account may do (SF §7). The choice is stored in `localStorage` (`ciq.persona`) and read when the store is created, so it survives a refresh. An unknown stored value is ignored and the default, Head of Claims, applies. The light/dark theme is handled the same way (`ciq.theme`).

### DD-08 Real sign-in against local Supabase; one demo account per persona

Sign-in uses real Supabase Auth from the first item. `auth:personas` creates four accounts (`head.of.claims@`, `claims.handler@`, `supplier.coordinator@`, `finance@claimsiq.local`, password `test1234`, local only; the script refuses to run against anything but the local stack). The development-only quick-pick on the sign-in page lists the same accounts: the seed script and the quick-pick both import the one list in `src/ui/src/auth/demoAccountList.ts`, and a SPA test checks that its names are the four persona labels. `scan-bundle` proves the quick-pick is absent from production builds.

Which account you sign in with does not choose the persona (DD-07).

### DD-09 Local stack beside TenderIQ's

`supabase/config.toml` uses project id `claimsiq` and the Supabase CLI default ports plus 100 (API 54421, Postgres 54422, Studio 54423, Mailpit 54424, SMTP 54425), so both products' stacks can run on one machine. The dev server uses 5273 and preview 4273, Playwright 5380.

### DD-10 One demo tenant

The shell labels the dataset with the fixture tenant `DEMO`, "Fictional Botswana insurer demo" (`02_expanded_demo_fixture/tenants.csv`), and the API client sends `X-Tenant-Id: DEMO` on every non-public call while the user is signed in. The name "The Brittany" is not shown in the application chrome (QuoteIQ removed it after review). Tenant switching does not exist yet; the data layer makes the label and the id follow the selected data set (TEST or DEMO).

### DD-11 What the scaffold does not contain

No contracts (`src/contracts`), mock API (`src/mock-api`), fixtures, rules or API functions. They are built by the data layer and rules items. The lint config already guards those folders: `src/contracts` stays pure TypeScript and zod, and `src/server` never imports the mock API.

### DD-12 CI and checks

`.github/workflows/ci.yml` and `scripts/ci/*` mirror TenderIQ's: typecheck, lint, unit tests against the local Supabase stack, SPA tests with a skip check and a test-count floor, build, the secret and bundle scans, and the Playwright suite. The floors are sized to what exists now and are raised when tests are added. `vercel.json` has no `api/` function entries until the backend exists. Replaced in part by DD-13 for the tooling.

### DD-13 Bun, not npm

ClaimsIQ uses Bun as package manager and script runner, unlike TenderIQ, which uses npm, because the owner's environment is Bun-first (QuoteIQ's first PR also used `bun.lock`). Consequences:

- `bun install` with the committed `bun.lock`; no `package-lock.json`. CI and Vercel install with `--frozen-lockfile`. The Bun version is pinned in `.bun-version` (read by `oven-sh/setup-bun`) and in `packageManager`.
- Every package script uses `bun run`, `bun run --filter <workspace> <script>`, `bunx` for CLIs and `bun <file>` for TypeScript and `.mjs` scripts. Nothing calls npm, npx or `node <file>`; `tsx` is gone because Bun runs the files. The `supabase` package is listed in `trustedDependencies` so Bun runs its postinstall, which downloads the CLI binary.
- The test runner stays Vitest (`vitest run`), not `bun test`; Vitest, Vite, ESLint and `tsc` run as their own binaries.
- `.nvmrc` and the Node `engines` entries are removed (this replaces the Node 24 pin of DD-02). Node is not a project requirement; the CI runner's Node, if present, is only what some binary's shebang finds, and Bun supplies a `node` shim when there is none.

## Data layer (Stage A, item 2)

### DD-14 Money uses decimal.js, as strings

Amounts are BWP strings with exactly 2 decimals (`"14000.00"`) in the contracts, the fixtures after loading, and every API answer. Arithmetic goes through `decimal.js` in `src/contracts/money.ts` (`sumMoney`, `addMoney`, `compareMoney`, `normalizeMoney`); a JS number never holds an amount. The CSV amounts without decimals (`14000`) are padded to 2 decimals before validation; anything else that is not a plain non-negative amount is rejected.

Why: SF §5 forbids float sums; `decimal.js` has its own types, rounds half-up by default and is already a transitive dependency of the chart library. The contracts' import rule now allows `decimal.js` beside `zod` (the folder stays pure TypeScript). Replaces the open question in DD-05 about money formatting: formatting from these strings is built with the screens.

### DD-15 Fixtures: versioned CSV folders, the tenant follows the data set

The spec's CSV files live in `fixtures/v1/test` and `fixtures/v1/demo`, next to `expected_metrics.json`, `proposed_rule_config.json` and the README of the spec pack; a changed fixture becomes `fixtures/v2`. The SPA bundles the CSV text with Vite and the loader (`src/mock-api/fixtures`) parses it in the browser. TEST is tenant `TEST` "Fixture validation", DEMO is tenant `DEMO` "Fictional Botswana insurer demo"; the shell takes both from `DATA_SETS` in `src/contracts/datasets.ts` (a test checks they equal `tenants.csv`). The default data set is DEMO. A row whose `tenant_id` is not the data set's tenant is rejected, so the two never mix. Replaces the fixed tenant constant of DD-10.

### DD-16 The mock API runs in the browser behind the client's transport

Stage A has no server. `src/mock-api` implements the typed endpoints of `src/contracts/endpoints.ts` as a `fetch`-shaped function and `src/ui/src/api/mockTransport.ts` hands it to the API client as the `transport` adapter (the platform `fetch` when no transport is installed). The context of a call travels in headers, as it would to a server: `X-Tenant-Id` (the data set's tenant), `X-As-Of` and `X-Persona` (the actor of a command). Answers are `application/problem+json` on failure. The API client keeps validating every answer against the endpoint's schema in development builds, so the mock cannot drift from the contract.

Lint boundaries: `src/mock-api` takes no Node module outside its tests and `test-support`; in the SPA only `src/api/mockTransport.ts` and tests import it. Stage B replaces `mockTransport.ts` with the real `fetch` and nothing else in the SPA. Reads are raw records, except `claims.facts`, which runs the rules engine over them (DD-22).

### DD-17 Validation: reject, warn, never coerce

The loader checks every row against the contracts and keeps a list of data issues `{ file, row, record_id, field, problem, fix }`. A bad row is **quarantined** (left out of the data) for: a value of the wrong form (date, amount, enum, boolean), a missing required field, a tenant other than the data set's, a duplicate id (the first row stays, later ones are rejected), a reference to a parent that is missing or itself rejected (so a rejected claim takes its events with it), a column count that does not match the header, a date before the one it must follow (policy end, due date, report, closure) and an allocation that would over-allocate an invoice or a receipt. A row with **missing evidence** (a claim event without a time, an invoice without a due date, a supplier request without a request time, a claim without a reported date, a closed claim without a closed date) loads with that field `null` and a warning, because the spec says missing evidence is UNKNOWN, never good or bad (SF §5, CL §7). The shell shows the issues under "Data issues (n)".

### DD-18 What "as of" does to a read

Every read takes the as-of date (default 2026-10-21, switchable in the shell and remembered in the browser). A read returns the records whose own date is on or before it: claims by reported date, claim events, reserve events, payments, supplier requests, receipts, allocations and payment attempts by their event dates; a record with an unknown date stays (unknown is not "later"). Values are never rewritten: a claim's `stage`, `status`, `current_outstanding_reserve` and `closed_at` stay as imported, and the rules engine derives the state at the as-of date from the events (CL §7). Not filtered: master data (clients, brokers, products, policies, suppliers, users), invoices (a scheduled instalment whose issue date lies after the as-of date is still a valid due item, and the fixtures hold such invoices) and tasks (workflow records stamped with the real time of the change, not the demo date). A task may only point at a claim that is visible at the as-of date of the request. Every answer says its `tenant_id` and `as_of`.

### DD-19 Changes in browser storage; Reset

What the user changes (tasks and their audit trail) is kept in `localStorage` under `ciq.mock.v1.<data set>.<tenant>`, apart from the fixture, and is merged over it on every read, so a refresh keeps it and the fixture itself is never modified. Reset (a confirm dialog, then `POST /api/v1/demo/reset`) removes the key of the selected data set: the fixture shows exactly as loaded. The data set and the as-of date are views and stay. The mock reads storage on every call, so a second client over the same storage sees the same state (the refresh test relies on it); a failed write answers 507 and the change is not shown as done.

### DD-20 Tasks: shape, actor and audit trail

A task has module (`CLAIMS`, `COLLECTIONS`), subject type (`CLAIM`, `POLICY`, `INVOICE`, `SUPPLIER`) and id, assignee (a user of the tenant or none), due time, priority (`LOW`, `MEDIUM`, `HIGH`), status (`OPEN`, `IN_PROGRESS`, `DONE`), a note and `updated_at`. The endpoints are create, assign and set status; each records an audit entry with the actor (the active persona, from `X-Persona`), the time (Africa/Gaborone, `+02:00`, from the API's clock) and the old and new value. The subject and the assignee must exist in the tenant (422 with the field otherwise). A create carries an `Idempotency-Key`, so a repeated submit returns the same task. Ids are `TASK-0001` and up. The fixtures' `tasks.csv` files are empty, so the statuses and priorities are ours.

### DD-21 Shell controls

The top bar carries the data set switch (TEST, DEMO), the as-of date, "Data issues (n)" (a dialog listing every issue with its file, row, field, problem and fix) and Reset, before the persona switch. Below 1280px the field labels stay for assistive technology only; below 768px the controls wrap onto a second row. Changing the data set clears the screens' filters (the ids differ) and every mounted query reads again.

## Rules engine (Stage A, item 3)

### DD-22 The engine is a pure folder, `src/rules`, and the API serves its facts

`src/rules` holds the claims rules as pure, deterministic functions: `computeClaimFacts` (one claim record, the as-of date, the rule config) and `summarizeClaimFacts` (any list of facts, so a screen can total a filtered subset and never disagree with its list). It imports only `zod`, `decimal.js`, its own files and `src/contracts` (lint-enforced, like the contracts), so Collections and dashboards can reuse it. The shapes of the facts and the summary are contracts (`src/contracts/facts.ts`); the endpoint `claims.facts` (`GET /api/v1/claim-facts`) returns `{ items, summary }` for the as-of view, and the mock API runs the engine on the same records `claims.list` returns. The rule config is validated by a zod schema (`src/rules/config.ts`) when the mock API is created; an invalid config fails there. Every threshold is read from it. Replaces the sentence of DD-16 that said metrics are not computed by the API.

### DD-23 How days are counted

Claim age is calendar days from the reported date to the as-of date. Stage time and supplier waits are business days: the weekdays named in `business_days` (Monday to Friday in the demo config) strictly after the start date up to and including the as-of date, so a stage entered on a Friday has one business day by Monday evening and none over a weekend (CL §8: "count completed business days at snapshot"). Public holidays are not supported; a config with `holidays_excluded: true` is rejected rather than ignored. Timestamps with a time are reduced to their Africa/Gaborone date for these counts. A stage is breached when business days in stage exceed its target (CL §7: "greater than target"), so being exactly at the target is not a breach. Age buckets are `0-7`, `8-30`, `31-60`, `61-90`, `>90`, built from the upper bounds in the config.

### DD-24 Current stage, open or closed, and the check against the record

The current stage is the `to_stage` of the latest event that has a time (ties on time go to the larger event id); events without a time cannot be ordered and are counted in `undated_events`. A claim is closed when that stage is Closed; a Reopened event makes it open again. With no dated event the recorded status decides and the stage is unknown. Claim records keep the stage, status and reserve as imported (DD-18), which are the state at the config's `as_of` (2026-10-21), so the check `stage_check` / `reserve_check` is `MATCHES` or `DIFFERS` only from that date on, `NOT_COMPARABLE` before it and `UNKNOWN` when there is no event to compare. A `DIFFERS` is the discrepancy alert CL §7 asks for.

### DD-25 Money: paid, reserve, incurred

Paid is the sum of `POSTED` payments dated on or before the as-of date; approved, pending, void and rejected never count. The reserve is the `new_amount` of the latest reserve event at the as-of date, never a sum of events; a claim with no reserve event takes the recorded value. Incurred is paid plus that reserve. The CLM-102 "original estimate P15,000" is the first reserve event; its incurred P17,000 is P5,000 paid plus the current P12,000 reserve (the P2,000 difference is not described as a reserve movement). The first reserve event of a claim, from zero, is `INITIAL` and never material (every claim would otherwise be flagged when opened). A later movement is material when it is at least the absolute threshold, or at least the percent threshold of a positive prior amount (the spec's "or"). Reserve movements are listed for closed claims too, by the same rule: a closing release such as CLM-103's P4,000 to P0 is material by the rule, and only open claims enter the severity and the summary counts. The material flag is a review cue; the facts say "reserve change", never leakage.

### DD-26 Missing evidence is unknown

A stage SLA is `unknown` (never `within`) when the claim has no dated stage event, when any of its events has no time (the stage start cannot be trusted), or when the stage has no target in the config (Reopened). A supplier request with no request time is `unverified`, not delayed. A claim is waiting on a supplier when it is open and has a request that is not completed on the as-of date, whatever its stage (the spec does not say which stages wait on suppliers); the target is `supplier_wait_target_business_days`. An open claim without a reported date has no age and is counted in `unknown_age`, apart from the buckets. Closed turnaround needs both the reported and the closed date; closed claims without them are counted in `closed_without_turnaround`.

### DD-27 "Approaching" and severity

CL §7 names "approaching target" without a number. A stage SLA is `approaching` when it is not breached and at most `approaching_window_business_days` (default 1) business days remain. The severity rules also name numbers the spec's config file does not carry, so the engine's config has optional fields with the spec's values as defaults: `severity_high_sla_days_late` (2), `severity_high_reserve_change_min_age_days` (30) and `age_bucket_upper_days` ([7, 30, 60, 90]). An open claim's severity is the highest of its reasons, each with the numbers that triggered it:

| Rule | Severity |
|---|---|
| `SLA_LATE`: breached by more than 2 business days | High |
| `RESERVE_CHANGE_AGED`: material reserve change and age over 30 days | High |
| `HIGH_VALUE_DELAYED`: incurred at or above the high-value threshold and (SLA breached or supplier delayed) | High |
| `SLA_BREACH`: breached by 2 or fewer | Medium |
| `SUPPLIER_DELAY`: a pending request beyond its target | Medium |
| `SLA_APPROACHING` | Low |
| `RESERVE_CHANGE`: material change on a claim aged 30 days or less | Low |
| `SLA_UNKNOWN`, `SUPPLIER_UNVERIFIED`: evidence is missing | Low |

The spec's tiers do not place a supplier delay, a lone reserve flag or missing evidence; those placements are ours. High value alone is a flag, not a reason: an open claim nothing was triggered on has no severity. Closed claims have no SLA, supplier waits or severity.
