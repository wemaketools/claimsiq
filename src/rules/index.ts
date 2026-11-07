/**
 * The claims rules engine: pure, deterministic functions over the contracts, reusable by Collections and dashboards.
 * `computeClaimFacts` takes the as-of view of one claim; `summarizeClaimFacts` totals any list of facts.
 */
import type { ClaimFacts, ClaimRecord, ClaimsSummary } from '../contracts/index.js';
import { computeClaimFacts } from './claimFacts.js';
import type { RuleContext } from './claimFacts.js';
import { summarizeClaimFacts } from './summary.js';

export * from './calendar.js';
export * from './claimFacts.js';
export * from './config.js';
export * from './period.js';
export * from './suppliers.js';
export * from './summary.js';
export * from './tasks.js';

export function computeClaimsFacts(
  claims: readonly ClaimRecord[],
  context: RuleContext,
): { readonly items: ClaimFacts[]; readonly summary: ClaimsSummary } {
  const items = claims.map((claim) => computeClaimFacts(claim, context));
  return { items, summary: summarizeClaimFacts(items, context) };
}
