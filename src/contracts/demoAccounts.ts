/**
 * The demo accounts: one per persona, created in Supabase Auth by `bun run auth:personas` and the demo seed, listed on
 * the sign-in page, and the only e-mails the demo sign-in endpoint accepts. The list holds no password: the server
 * reads it from its own environment (`DEMO_SEED_PASSWORD`). `persona` is the view a click on the account's card sets;
 * it is never authentication, and a typed sign-in leaves the stored persona alone.
 */
import type { PersonaId } from './personas.js';

export interface DemoAccount {
  readonly email: string;
  readonly fullName: string;
  readonly persona: PersonaId;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { email: 'head.of.claims@claimsiq.local', fullName: 'Head of Claims', persona: 'head-of-claims' },
  { email: 'claims.handler@claimsiq.local', fullName: 'Claims Handler', persona: 'claims-handler' },
  { email: 'supplier.coordinator@claimsiq.local', fullName: 'Supplier Coordinator', persona: 'supplier-coordinator' },
  { email: 'finance@claimsiq.local', fullName: 'Finance', persona: 'finance' },
];

/** True for an e-mail on the list (case and surrounding spaces ignored). */
export function isDemoAccountEmail(email: string): boolean {
  const wanted = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.some((account) => account.email === wanted);
}

/** `code` of the problem a refused demo sign-in answers with (any e-mail off the list, any failed sign-in). */
export const DEMO_SIGN_IN_REFUSED_CODE = 'DEMO_SIGN_IN_REFUSED';
/** `code` of the problem the endpoint answers with in an environment that has no demo password. */
export const DEMO_SIGN_IN_NOT_CONFIGURED_CODE = 'DEMO_SIGN_IN_NOT_CONFIGURED';
