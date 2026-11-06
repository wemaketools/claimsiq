/**
 * The demo accounts of the local development quick-pick.
 *
 * DEVELOPMENT BUILDS ONLY: this module is reached only through the dynamic import in SignInPage, which sits behind
 * `import.meta.env.DEV`, so Vite drops it from production builds. `scan-bundle` fails the build if
 * `DEMO_ACCOUNTS_MARKER` appears in `src/ui/dist`.
 *
 * The accounts are created in LOCAL Supabase Auth by `bun run auth:personas` (scripts/dev/seed-auth-personas.ts keeps
 * the same list) with the password `test1234`. This list only fills the sign-in form: signing in is real
 * (supabase-js). An account does not decide the persona view; the persona switch does.
 */

export const DEMO_ACCOUNTS_MARKER = 'ciq-demo-accounts-dev-only-quick-pick';

/** The local-only password of every demo account (never valid outside the local Docker stack). */
export const DEMO_PASSWORD = 'test1234';

export interface DemoAccount {
  readonly email: string;
  readonly fullName: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { email: 'head.of.claims@claimsiq.local', fullName: 'Head of Claims' },
  { email: 'claims.handler@claimsiq.local', fullName: 'Claims Handler' },
  { email: 'supplier.coordinator@claimsiq.local', fullName: 'Supplier Coordinator' },
  { email: 'finance@claimsiq.local', fullName: 'Finance' },
];
