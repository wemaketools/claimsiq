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

Each destination is a feature module (`src/ui/src/features/<feature>`). Until the data layer exists, a page shows its title and one of three states through `useScreenStatus` and `ScreenStates`: loading, then an empty state, or an error state with retry when its loader fails. The screens that follow replace the page body with real content and drop the placeholder. Replaced in part by DD-44: the last placeholder screens were built and `useScreenStatus`, `ScreenStates` and `configureScreenLoader` are deleted; every screen now shows its states through `useApiQuery`, `DataTable` and `QueryView`.

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

Lint boundaries: `src/mock-api` takes no Node module outside its tests and `test-support`; in the SPA only `src/api/mockTransport.ts` and tests import it. Stage B replaces `mockTransport.ts` with the real `fetch` and nothing else in the SPA. Reads are raw records, except `claims.facts` (DD-22) and `suppliers.insights` (DD-40), which run the rules engine over them, and the `overdue` flag on each task of `tasks.list` (DD-42).

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

`src/rules` holds the claims rules as pure, deterministic functions: `computeClaimFacts` (one claim record, the as-of date, the rule config) and `summarizeClaimFacts` (any list of facts, so a screen can total a filtered subset and never disagree with its list). It imports only `zod`, `decimal.js`, its own files and `src/contracts` (lint-enforced, like the contracts), so Collections and dashboards can reuse it. The shapes of the facts and the summary are contracts (`src/contracts/facts.ts`); the endpoint `claims.facts` (`GET /api/v1/claim-facts`) returns `{ items, summary, breakdowns }` for the as-of view, narrowed by the query of DD-28 and with the period figures of DD-33 and the breakdowns of DD-34, and the mock API runs the engine on the same records `claims.list` returns. The rule config is validated by a zod schema (`src/rules/config.ts`) when the mock API is created; an invalid config fails there. Every threshold is read from it. Replaces the sentence of DD-16 that said metrics are not computed by the API.

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

## Overview and Stages & Aging (Stage A, item 4)

### DD-28 Shared filters narrow the engine's answer, in the API, and live in the shell state

Policy, broker, product and handler are query parameters of `claims.facts` (`ClaimFactsQuery`); the mock API narrows the claims before the engine runs, so `items` and `summary` always describe exactly the filtered claims and a screen never totals or recounts anything itself (CLM-FR-12). Broker and product reach a claim through its policy. The filters are one state for every claim screen (`filters.byScreen['claim-scope']`), so Overview, Stages & Aging and Claims always agree. The filters slice is now remembered in the browser (`ciq.filters`, written by every store, read once when the store is created, anything that is not a map of filter values ignored) and is cleared when the data set changes or the user signs out. The as-of date stays in the top bar. The filter choices come from the master data (policies by policy number, brokers, products) and from the users who handle claims. `ClaimsSummary` gains `open_unknown_stage`, the open claims among `unknown_stage`, so the stage table of open claims can say what is left over without counting closed claims.

Why: the owner's rule is that the UI never recomputes rules; a filter applied after the engine would make the cards and the list disagree.

### DD-29 What each card counts, and the click-through

Overview shows the snapshot at the as-of date: open and closed claims, paid to date (posted payments), outstanding reserve, incurred (paid plus reserve), SLA breaches (open claims past their stage target) and high-value open claims, all from the engine's summary. The spec's "new claims in period", "paid in period" and "average closed turnaround" cards need an event window the shell does not have; they are not built, and the summary already holds the turnaround for the later item that needs it. Each card, and each row of the stage and age tables, links to the Claims page with a criterion in the address (`/claims?show=open`, `closed`, `sla-breached`, `high-value`, `paid`, `reserve`, `incurred`, `stage:<Stage>`, `age:<bucket>`, with `unknown` for open claims with no stage or no reported date). A criterion only selects from the engine's facts for the current filters and as-of date; the money cards list the claims that have that figure above zero, so their amounts add up to the card. A test checks, over TEST and DEMO, three dates and five filter views, that every figure equals the claims its criterion selects, that each filter's values split the claims with none lost or counted twice, and that the stage and age rows add up to the open count (CLM-AT-03, -12). Overview's stage rows leave out Closed (closed claims are not open claims) and Reopened while no claim is in it.

The period cards this entry leaves out are built; see DD-33 for them and DD-36 for the one card whose list changed.

### DD-30 CSV: what is in the file

Overview, Stages & Aging and Claims each export what is on screen: the same filters, the same as-of date, the same order. Amounts are plain decimals with two places (`9000.00`) in columns whose header says BWP (`Paid (BWP)`); counts are plain numbers; a figure that does not apply (age of a closed claim, SLA of a closed claim) is an empty cell where the screen shows a dash. The Claims export is the whole filtered list, not the page on screen (paging is a viewing aid); the page count is "Showing 1–25 of 30". Overview's file has one row per card, stage and age bucket (`Section, Measure, Claims, Amount (BWP)`); Stages & Aging's has the stage and age rows with their money and an "All open claims" total (`Section, Item, Claims, Paid, Reserve, Incurred`). Files are named `claimsiq-<screen>-<data set>-<as-of date>.csv`, quoted per RFC 4180 with CRLF lines, and a text cell that starts like a spreadsheet formula (`=`, `+`, `-`, `@`) is prefixed with an apostrophe. The button gives no toast: the browser shows the download. One helper (`lib/csv.ts`) and one button (`claim-scope/ExportCsvButton`) serve every screen. The CLM-AT-14 check is a test per screen that parses the downloaded text and compares it to the cells on screen.

Overview's file later gained the period figures and a Days column (DD-35); the description of its columns above is the first version.

### DD-31 The 3 second check is a measured test on a generated 500-claim set

`src/mock-api/test-support/generatedFixture.ts` builds a deterministic claims fixture of any size (the same count gives the same files; every claim reconciles with the engine, so it loads with no data issues) from the DEMO master data. It is a test aid, not a third data set of the product: the browser build bundles only TEST and DEMO. The check is a Vitest test (`features/overview/performance.test.tsx`) that renders Overview over a mock API holding 500 claims, with the API client's development-build response validation on, and fails if the cards, the age chart and the filter choices are not all there within 3 seconds; on the development machine it takes well under a second. A Playwright timing would measure a real browser but cannot load the generated set into the bundled fixtures without a third data set, so the browser flow runs on TEST and checks the figures, not the clock.

### DD-32 Claims list

The list shows id (a link to `/claims/<id>`, the claim detail page of a later item), client, product, current stage, age in days, handler, paid, reserve, incurred, SLA status and severity, sorted by any column (claim id by default; ties keep claim order) and 25 per page (25, 50 or 100). A banner names the criterion and the number of claims and offers "Show all claims"; an unknown criterion in the address is said so and every claim is listed. It has the loading, error (with Try again) and empty states, and a different empty message when a filter or criterion is what empties it. All personas see these three screens; nothing in the specs limits them.

### DD-33 Period figures: the window and the cohort logic (CL §5 CLM-01, §7; CLM-FR-02, -03, -06)

Replaces the sentence of DD-29 that left the period cards unbuilt. The period figures belong to the rules engine (`src/rules/period.ts`, `claimFacts.ts`, `summary.ts`), which `claims.facts` serves for a window named by the query parameter `period`; the screens compute nothing.

- **Window.** The shared filter bar offers Last 7 days, Last 30 days (the default), Last 90 days and Month to date. The window ends on the as-of date and includes it; "last N days" are the N calendar days ending that day (7 days ending 21 Oct start on 15 Oct); month to date starts on the 1st of the as-of month. Both ends are Africa/Gaborone calendar dates. The choice is stored with the other filters (`ciq.filters`) and survives Clear filters, which only clears the four narrowing filters. It shows on Overview, and on Claims while the page is listing a period criterion.
- **New claims in period:** claims whose reported date falls in the window. A claim with no reported date is in no window (it is not guessed) and shows in the age figures as unknown.
- **Paid in period:** the sum of POSTED payments whose payment date falls in the window. Approved, pending, void and rejected payments never count (CLM-AT-04, -11), so an approved-but-unpaid claim adds nothing. The card also says how many claims the payments were on.
- **Average closed turnaround (the cohort).** The cohort is the claims that are closed at the as-of date and whose closed date falls in the window. A claim that was reopened is open, so it is not in the cohort. The average is the mean of calendar days from reported date to closed date over the cohort claims that have both dates, to one decimal; a cohort claim with no reported date is left out of the mean and counted ("left out for missing dates"); a closed claim with no closed date at all cannot be placed in any window, so it is counted apart ("closed with no closing date") and shown on the card when there is one. With no averageable claim the card shows a dash, never zero. Both counts are in the CSV.
- **High-priority exceptions:** open claims with High severity at the as-of date (DD-27); not windowed.
- **Currently open** stays the snapshot at the as-of date (DD-29), beside paid to date, reserve, incurred, SLA breaches and high-value claims.

The facts carry the flags (`reported_in_period`, `closed_in_period`, `paid_in_period` per claim) and the summary counts them, so a card and the list behind it select from the same facts. Each period card opens the Claims page with a criterion: `new-in-period`, `paid-in-period`, `turnaround` (the turnaround card, listing exactly the claims it averaged; see DD-36) and `high-priority`. The spec says a card may open claims or claim payments; Stage A opens claims, and for the paid card the list adds a "Paid in period" column whose amounts add up to the card, so the payments behind it are visible. A claim payments screen is not built. The Overview groups its eleven cards under "As of {date}" and "{period}: {from} to {to}".

### DD-34 Stages & Aging: stage value and the product, broker and owner split (CL §5 CLM-02)

Stage value is gross incurred (paid plus outstanding reserve) of the open claims, because incurred is the spec's headline value (CL §7); paid and reserve stay beside it in the stage and age tables. Stages & Aging draws it as a bar list of incurred by stage and by age bucket, linking to the claims behind each row. The open claims by product, broker and owner (the handler) come from `claims.facts` as `breakdowns`: the API groups the engine's open facts with `breakdownOfOpenClaims` (policy gives a claim its product and broker), largest incurred first, each with claims, paid, reserve and incurred. Each split holds every open claim once, so each adds up to the open count and the open incurred (a test checks it over TEST and DEMO). A policy with no broker is "No broker". The three splits are tabs of one table and follow the shared filters; rows do not drill down, because the filter bar already narrows by each of them. Unknown dates stay listed apart as before (open claims with no reported date in the age table, with no dated stage event in the stage table). The stages CSV carries the stage, age, product, broker and owner rows and the total.

### DD-35 CSV of the period figures, and toasts

Overview's CSV gains a Days column (`Section, Measure, Claims, Amount (BWP), Days`) and its sections are the two card headings ("As of 21 Oct 2026", "Last 30 days: 22 Sep 2026 to 21 Oct 2026"); the turnaround row has the number of claims averaged and the days, and a row after it counts the claims left out of the average. The Claims CSV adds "Paid in period (BWP)" only when the list shows that column. `ToastProvider` rendered `<li role="status">` inside a `<ul>`, which fails axe's `list` rule whenever a toast is on screen; the toasts are now plain elements in a labelled `region` live region, and the e2e flow runs axe with the Reset toast showing.

### DD-36 Review round: the turnaround list, the export gate, and the shared SPA files #6 touched

Replaces the criterion name in DD-33: the average closed turnaround card opens `turnaround`, which selects exactly the claims averaged (closed in the period, with both dates), so its list is as long as the number it averaged. The claims left out for a missing reported date, and the closed claims with no closing date, are counted on the card and as rows after it in the CSV, both made from the same `notes` of the figure. The export button alone decides when a file may be written (`ExportCsvButton` takes the screen's scope): not while a request is on its way and not after a failed one, because the screen may then still show the previous filters' figures.

Shared SPA files this item changed, and why each could not stay inside a feature: `app/store.ts`, `app/slices/filters.ts` and `lib/storage.ts` (the owner decided the filters persist like the other shell state, which is written once for every store and read once when it is created); `components/ui/ToastProvider.tsx` (`li role=status` inside a `ul` fails axe whenever any toast shows, so the fix belongs to the component); `components/charts/DonutChart.tsx` (recharts makes the pie focusable inside an `aria-hidden` figure; only the component can pass `rootTabIndex`). The unit and SPA tests of those files were changed with them (`navigation.test.tsx`, `slices.test.ts`, `router.test.tsx`).

## Exceptions & SLA, Claim Detail and the policy invoices (Stage A, item 5)

### DD-37 Exceptions queue (CL §5 CLM-03, CLM-FR-11)

The queue is the open claims the engine flagged (`severity` set) plus open high-value claims, one row per claim. A high-value claim nothing else flagged shows with no severity and the reason "High value" (DD-27: a flag, not a rule); in the fixtures every high-value open claim is also delayed, so it does not appear alone. The spec's "open age" has no rule of its own in the engine (CL §7 only combines age with a reserve change), so age is a reason only inside that rule; no age-only exception is invented.

Each reason shows its label, its rule id and the trigger data in words ("Assessment: 10 business days over a 5-day target"; "Reserve moved up P3,000.00, P8,000.00 to P11,000.00 (at least 30% of the earlier amount)"). The reserve reason reads the claim's latest material movement; the movement facts now carry `material_by` (`AMOUNT` or `PERCENT`) and the thresholds, so the screen can say which test fired without knowing the rule config. Owner is the handler. Days late is the larger of the stage clock's business days over target and any delayed supplier request's; it is empty when nothing is late. The rows sort by any column; ties fall back to severity, then more days late, then claim order, so the default (severity) is severity then days late. The queue filters by the shared claim filters plus severity and reason, remembered like the other screen filters. The CSV is the filtered, sorted list as on screen (reasons joined as `Label (RULE): text`, an empty cell where the screen shows a dash, open task count). Wording is "review", "exception", "indicator"; never fraud or leakage.

From a row, "Create follow-up task" opens a confirm dialog (who acts, scope, result stated as in the other dialogs) with the next action (required, stored as the task note), assignee, priority (starts from the severity) and due date, and creates a CLAIM task through `tasks.create`; the row's open task count and the claim's task list show it. The full Action Queue is the next item.

### DD-38 Claim Detail (CL §5 CLM-04, CLM-FR-13)

`/claims/:claimId` reads the claim record (`claims.get`), the engine's facts for that claim (`claims.facts` now takes `claim_id`), its tasks and the master data names. Source identifiers are shown beside every name. The stage timeline lists the claim's events oldest first (the engine's order: time, then event id; `chronological` (with `momentMs`) moved from `src/rules` to `src/contracts/time.ts` so the screen and the engine order by the same function), marks the last dated event as the current stage, lists events with no time apart at the end ("cannot be placed in order"), and states the check of the recorded stage against the events; a difference is a warning banner. Reserve history is old to new with before, after, change and percent; a material move carries the review flag and the test that fired, and the card says it is a cue, not a finding. Paid, reserve and incurred are three figures with their sum written out; an approved or settlement claim with no posted payment shows "Approved is not paid". Payments are two lists, posted (counted) and pending, void or rejected (shown, not counted). Supplier requests show requested, completed, the wait in business days against the target and the status (a request with no request time is "Unverified", with its target). A claim with no trusted stage time shows a banner "SLA unknown" and never "within target". The claim's tasks show note, assignee, due date and the audit trail (who, what, when). A claim not visible at the as-of date, or not in the data set, shows "Claim not visible" with the date and a way back.

Shared pieces moved into `features/claim-scope` so the Claims list, the queue and the detail say the same thing: severity and SLA chips and labels, the reason texts, the date format with "Unknown" for a missing one and the in-app paths. The follow-up task dialog and its labels are in `features/claim-tasks`.

### DD-39 Policy invoices, the stand-in for Premium Collections (CLM-FR-16, CLM-AT-15)

Until Premium Collections exists (the link question is open in the repository's Collections issue), `/policies/:policyId/invoices` is a read-only view built from the fixture and clearly marked as a stand-in. `invoices.list` takes `policy_id`, and the mock API keeps exactly the invoices whose `policy_id` equals it; nothing is matched by name. The page shows the policy (number, client, product, broker, period of cover, status) and one row per invoice: invoice, issued, due ("Unknown" when the date is missing), amount, allocated (the sum of its allocations), outstanding (amount less allocated, as Collections defines invoice outstanding: issued less allocations; "unapplied" is reserved for received cash not yet matched to an invoice), status and the receipts allocated. The fixture has no billing-period field on an invoice, so the period shown is the policy's period of cover. A policy with no invoice says so explicitly, and a policy that does not exist is "Policy not found". The claim's policy number and a "View policy invoices" button lead here with `?claim=` so the page can lead back. Claim and invoice stay unjoined in any other way, and a later link to the real Collections screen replaces this page.

## Supplier Insights and Action Queue (Stage A, item 6)

### DD-40 Supplier Insights (CL §5 CLM-05, CLM-FR-08)

The supplier figures belong to the rules engine (`src/rules/suppliers.ts`, `summarizeSuppliers`), which the mock API serves as `suppliers.insights` over the same narrowed claims as `claims.facts` (the shared policy, broker, product and handler filters of DD-28); the screen computes nothing. One row per supplier of the data set, listed alphabetically and never ranked (no column sorts the table). A supplier's **cases** are the open claims assigned to it or holding a request to it (`isSupplierCase`, in `src/contracts`, so the engine and the Claims list's `supplier:<id>` criterion select the same claims). The figures:

- **Open requests:** requests to the supplier on open claims not completed at the as-of date; those with no request time are counted too and shown as "with no request time" (unverified, DD-26), and are not part of any wait.
- **Average and longest wait:** business days from the request to the as-of date (DD-23), over the open requests that have a request time. The average carries the number of requests behind it.
- **Past target (breaches):** open requests the engine marks `delayed` (waited more than `supplier_wait_target_business_days`, 5 in the demo config), so the screen and Claim Detail agree.
- **Open cases:** open claims assigned to the supplier (the claim's `supplier_id`).
- **Late actions:** tasks not done whose due date is before the as-of date (DD-42), on the supplier's cases. Only claim tasks count; a task is counted once per supplier whose case it is on.
- **Average turnaround:** business days from request to completion over the supplier's completed requests (on open claims; a closed claim has no supplier waits, DD-26), with the number of completed requests.

Clicking a supplier opens the Claims list with the criterion `supplier:<id>`: exactly its cases, as many as the figures were made from. The CSV (`claimsiq-suppliers-<data set>-<as-of>.csv`) has one row per supplier with every figure and its sample in its own column; an average held back is an empty cell. The export button is gated on the engine answer and the supplier names (`ExportCsvButton` now takes the list of queries the table is built from).

### DD-41 "Ranking not misleading on small sample": the minimum is 2 requests

An average is shown only from `supplier_min_sample` requests, a rule-config field of ours (the spec only says a small sample must not mislead), default **2**, with the sample size written beside every average ("14.0, 2 requests"; below the minimum: "1 of 2 needed"; none: "No requests" / "None completed"). The longest wait and the breaches are shown whatever the sample, because they are facts about named cases, not statistics. Why 2 and not 3: both fixtures hold exactly two requests, both with one supplier, so a minimum of 3 would hold back every average on both data sets and the screen could not show the average wait the issue asks for; 2 is the smallest sample from which an average says more than a single reading. The owner can raise it in the rule config (a test shows two requests no longer averaging at 3). There is no ranking at all, so a small sample cannot put a supplier "first".

### DD-42 Action Queue and the task rules (CL §5 CLM-06, CLM-FR-14)

The queue lists every task of the data set: claim (a link, with the task number below it), issue, owner, due date, priority, status, updated and notes. **Issue** is the labels of the claim's current exception reasons from `claims.facts` ("Not flagged" when it has none, a dash while the flags could not be loaded, which the page says); **notes** is the task's note (the next action it was created with). Rules that belong to the engine and the contracts:

- **Overdue:** a task is overdue when it is not Done and its due date (Africa/Gaborone) is before the as-of date, so one due on the as-of date is not late and one with no due date never is (`isTaskOverdue`). `tasks.list` returns the flag (`TaskListItem.overdue`); the screen only reads it. Overdue follows the as-of date, not the wall clock, so the demo date drives it like every other figure.
- **Status changes:** Open can go to In progress or Done, In progress back to Open or on to Done, and a Done task can only be reopened (`TASK_STATUS_TRANSITIONS`, in the contracts). The API refuses the others with a 422 on `status`, and the dialog offers only the allowed ones.
- **Default order:** overdue first, then High before Medium before Low, then the earlier due date (none last), then task number. A column header sorts by that column with the queue order breaking ties; Clear filters also puts the default order back. Filters: status, owner (including "Not assigned") and priority.

Actions: Create task (the same dialog as Exceptions and Claim Detail; started from the queue it asks which claim), Assign owner and Change status (confirm dialogs that name the acting persona and the result, as DD-20 logs it), Open claim, and the row itself opens the task's history: who did what and when, oldest first, the actor being the active persona. The same Assign and Change status buttons are on each task of Claim Detail. The CSV is the filtered, sorted queue as on screen, with an Overdue column. Tasks stay in browser storage until Reset (DD-19). Not built: editing a task's due date, priority or note after it is created (the spec asks for create, assign, status and the audit trail); the audit trail of a status change carries an optional note.

### DD-43 No persona is restricted on these screens

The spec limits no screen or action by persona (CL §4 lists the questions each persona asks, not permissions), so, as in DD-32, every persona sees Supplier Insights and the Action Queue and may create, assign and move tasks. There is no restricted state to show; the persona is the actor of each change in the audit trail. If a later spec gives a persona view-only access, the Create task button and the row actions are the places that become `RestrictedState` or disappear, and the API (which already receives `X-Persona`) is where the 403 belongs.

### DD-44 Shared SPA files this item changed

`claim-scope/ExportCsvButton.tsx` (takes `queries`, the queries its table is built from, instead of the claim scope, because the Action Queue and Suppliers have more than the claim facts behind them; the four earlier screens pass `[scope.facts]`), `claim-scope/criteria.ts` (the `supplier:<id>` criterion), `components/ui/ConfirmActionDialog.tsx` (`confirmDisabled`, for a dialog whose own fields must be chosen first), `claim-detail/TasksCard.tsx` (Assign and Change status per task; the audit trail and the status chip moved to `claim-tasks/TaskParts.tsx`, their strings from the `claim-detail` catalog to `claim-tasks`) and `test/datasets.ts` (a rule config with changed thresholds). The loading, empty and error placeholder of DD-06 (`useScreenStatus`, `ScreenStates`, `configureScreenLoader`) is deleted: Suppliers and the Action Queue were its last users, and the router test of the loading and error states now runs on Suppliers' real request.
