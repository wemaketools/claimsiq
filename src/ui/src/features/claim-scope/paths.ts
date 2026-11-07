/** The in-app addresses a claim leads to. */
import { CLAIMS_PATH } from './criteria';

export const claimPath = (claimId: string): string =>
  `${CLAIMS_PATH}/${encodeURIComponent(claimId)}`;

/** The policy's invoices; `fromClaim` lets that page lead back to the claim the user came from. */
export function policyInvoicesPath(policyId: string, fromClaim?: string): string {
  const base = `/policies/${encodeURIComponent(policyId)}/invoices`;
  return fromClaim === undefined ? base : `${base}?claim=${encodeURIComponent(fromClaim)}`;
}
