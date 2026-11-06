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
