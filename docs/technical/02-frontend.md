# Frontend (SPA)

Status: as built (scaffold, data layer, the claim screens: Overview, Stages & Aging, Claims, Exceptions & SLA, Claim Detail, policy invoices, and Supplier Insights and the Action Queue). The decisions behind it (prefix and palette, brand, navigation, persona switch, tenant) are in `docs/plan/design-decisions.md`.

## Layout of `src/ui/src`

| Path | Contents |
|---|---|
| `theme/` | `tokens.css` (the `--ciq-*` custom properties for light and dark), `components.css` (the `.ciq-*` classes), `index.css` (self-hosted Inter and JetBrains Mono from `public/fonts`, imports) |
| `components/ui/` | The design-system components (Button, Card, Chip, DataTable, Dialog, forms, KpiCard, Menu, Tabs, Timeline, EmptyState/ErrorState/RestrictedState, …). Features import from `components/ui` |
| `components/charts/` | Recharts wrappers on token colours; every chart has a table alternative for assistive technology |
| `components/shell/` | `AppShell`, `Sidebar`, `Topbar`, `UserCard` |
| `app/` | Store and slices (`session`, `dataContext`, `filters`), `dataContextActions.ts`, `router.tsx`, `RouteGuard`, the feature registry, `personas.ts`, `tenant.ts` |
| `api/` | `client.ts` (`call(endpoint)`), `hooks.ts` (`useApiQuery`, `useApiMutation`, `invalidateApiQueries`), `endpoint.ts`, `problem.ts`, `mockTransport.ts` (Stage A: the in-browser mock API as the transport) |
| `auth/` | `AuthProvider`, sign-in, forgot and reset password, the development-only `DemoAccounts` |
| `features/<feature>/` | `routes.tsx`, the page, `i18n/en.ts` |
| `features/claim-scope/` | No route: what the claim screens share (see Claim screens) |
| `features/claim-tasks/` | No route: what every screen that shows a task shares: the create (claim given or chosen), assign-owner and change-status dialogs, the status chip, the audit trail and the labels |
| `features/suppliers/`, `features/actions/` | Supplier Insights (`suppliers.insights`, rows and CSV in `rows.ts`) and the Action Queue (`tasks.list` joined to the claim's flags and the owner's name; queue order, filters and CSV in `rows.ts`) |
| `features/claim-detail/`, `features/invoices/` | Routes without a nav item: `/claims/:claimId` and `/policies/:policyId/invoices` (the stand-in for Premium Collections) |
| `lib/` | `i18n.ts` (`t()`), `format.ts`, `csv.ts` (CSV text and download), `zonedTime.ts`, `storage.ts` (persona, theme, data set, as-of date, screen filters), `useMediaQuery.ts`, `useNow.ts` |
| `i18n/en.ts` | The shell catalog (namespaces `shell`, `auth`, `ui`, `format`, `charts`, `pages`) |

## Design system

Tokens and classes are the suite's, with the prefix `ciq`. Components use tokens only: no raw hex, no literal pixel gaps (half steps are tokens: `space-0-5`, `space-1-5`, `space-2-5`). The theme is the `data-theme` attribute on `<html>` (`light` or `dark`), set by `AuthProvider` from the session slice and remembered under `ciq.theme`. Text colours on tinted surfaces use the AA `-text` tokens; solid fills use `accent-fill` with `on-solid`.

## Shell

Dark sidebar (tenant label, wordmark, sub-brand, the six destinations, the user card), a sticky top bar of at least 64px (page title, the data controls, **Viewing as** persona switch, theme toggle; below 768px the data controls wrap onto a second row) and the main region. Below 1280px the sidebar is an icon rail by CSS; below 768px it is a drawer (closed: hidden from focus; open: focus moves to the first link; Escape or the scrim closes it). Pages put their title in the top bar through `PageHeader`, and their own actions in the page head.

The persona is `session.persona`, written by `choosePersona` (which also stores it) and read once when the store is created. The user card shows the name of the account and the active persona.

## Data controls and context

`session` holds who is signed in; `dataContext` holds the data set (TEST or DEMO, default DEMO) and the as-of date (default 2026-10-21). Both are remembered under `ciq.dataSet` and `ciq.asOf` and read once when the store is created. The tenant is `tenantOf(dataSet)` (`useTenant()`), and the sidebar label and `X-Tenant-Id` follow it. `chooseDataSet` and `chooseAsOf` store the value, update the slice and make every mounted query read again; `useApiQuery` keys its cached data on data set and as-of date too, so a query never shows the other data set's records while it loads, and a different request (another claim, another policy) shows no data until it answers; only a list filtered in place opts into keeping the previous answer (`keepPrevious`).

`DataControls` (top bar): the data set select, the as-of date, "Data issues (n)" (`DataIssuesDialog`, from `data.issues`) and Reset (`ConfirmActionDialog`, then `demo.reset`; the data set and the as-of date stay). Below 1280px their labels are visually hidden, below 768px they wrap onto a second row.

## Feature modules

A feature is `features/<feature>/routes.tsx` exporting `features: FeatureModule[]` (`id`, `routes`, `nav`). The registry collects every such file with `import.meta.glob`, validates it (duplicates and malformed modules are reported with `console.error` and skipped), and both the router and the sidebar are built from the result. Routes are paths in the shell, `load` for a code-split page or `element` for an eager one. Nav items have an id, an i18n label key, a path, an order and an icon. The feature's strings live in `features/<feature>/i18n/en.ts`; its keys are namespaced by the directory name, which must not be one of the shell namespaces.

Routes: `/` redirects to the first destination; `/signin`, `/forgot-password`, `/reset-password` are outside the shell; every feature route is inside `RouteGuard` and `AppShell`; anything else is Not found (inside the shell when signed in). A route that fails to load or throws renders `RouteErrorPage` inside the shell.

## Claim screens

Overview (`features/overview`), Stages & Aging (`features/stages`) and Claims (`features/claims`) read one engine answer through `features/claim-scope`: `useClaimScope()` returns the shared filters (policy, broker, product, handler, and the period window of the period cards: `filters.byScreen['claim-scope']`, remembered under `ciq.filters`, cleared with the data set and on sign-out; Clear filters keeps the period), the `claims.facts` query for exactly those filters (the answer holds `items`, `summary` with its `period` figures, and the product, broker and handler `breakdowns`) and the master-data lookups (`useClaimLookups`: names for client, product and handler and the filter choices). `ClaimFilterBar` is the one filter bar. `criteria.ts` holds the criterion a figure counts, how it travels in the address (`/claims?show=stage:Assessment`) and the predicate that selects those claims from the facts; `stageAgeRows.ts` makes the stage and age rows from the summary; `ExportCsvButton` downloads the rows a screen builds from its own figures (`lib/csv.ts`) and is off while any of its required `queries` is on its way or has failed; `optionalQueries` are only waited for, so the Action Queue still exports with a dash where the claim facts failed (DD-36, DD-44). Screens never recompute a rule: a figure is a field of the engine's summary, a list is a selection of its facts. `reasons.ts` writes the engine's severity reasons in words (rule, trigger data), `Chips.tsx` and `labels.ts` are the severity and SLA chips, `moment.ts` formats a date or time (a missing one reads "Unknown") and `paths.ts` holds the claim and policy-invoice addresses. Exceptions & SLA (`features/exceptions`) lists the flagged open claims with the shared filters plus severity and reason; Claim Detail reads `claims.get`, `claims.facts` for one `claim_id`, the claim's tasks and the master names. Decisions: DD-28 to DD-39.

Supplier Insights reads the shared filters through `useClaimScope()` and its own figures from `suppliers.insights`; a supplier opens the Claims list with the `supplier:<id>` criterion (DD-40, DD-41). The Action Queue has its own filters (status, owner, priority), is never limited by persona (DD-43) and shows the engine's `overdue` flag on each task (DD-42); its dialogs, and the same assign and status buttons on Claim Detail's task list, are the ones in `features/claim-tasks`.

## States

Every screen has a loading, an empty and an error state, and a restricted state where a view can be limited. `EmptyState`, `ErrorState` (a 403 renders the restricted state instead) and `RestrictedState` are in `components/ui`; `QueryView` wires a `useApiQuery` result to them.

## API client

`call(endpoint, { params, query, body }, options)` sends the bearer token (read per request from the supabase-js session), `X-Tenant-Id`, `X-As-Of` and `X-Persona` (none of them on `public` endpoints), an `Idempotency-Key` on idempotent commands, normalizes `application/problem+json` to `ApiError`, signs the user out on 401 and, in development builds, parses the response with the endpoint's zod schema so drift fails loudly. `AuthProvider` installs the adapters with `configureApiClient`, including the `transport` that `main.tsx` passes (the mock API in Stage A; the platform `fetch` when none is given). The endpoints are the typed contracts of `src/contracts` (`endpoints.claimsList`, `endpoints.tasksCreate`, …); screens call them with `useApiQuery` and `useApiMutation` and never import the mock API.

## Tests

Vitest with jsdom, colocated `*.test.ts(x)`; setup in `test/setup.ts`; helpers in `test/` (`renderWithProviders`, `installFetch`, `signedInSession`). The stylesheet contracts jsdom cannot measure are asserted on the CSS text (`theme/components.test.ts`). The Playwright suite in `e2e_tests/specs` signs in with the seeded accounts and runs axe.
