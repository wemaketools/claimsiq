import type { VerifiedToken } from '../auth/verify.js';
import type { TenantId } from '../db/index.js';

/** What the middleware before a route establishes. */
export interface RequestVariables {
  readonly correlationId: string;
  /** Set by the session middleware. */
  readonly session: VerifiedToken;
  /** Set by the tenant middleware: the tenant the caller is a member of. */
  readonly tenantId: TenantId;
}

export interface ApiEnv {
  Variables: RequestVariables;
}
