/** The claim stage map and the what-if: one hypothetical stage event appended to a claim, for the engine to read like any other. */
import { CLAIM_STAGES } from '../contracts/index.js';
import { endOfDay } from '../contracts/time.js';
import type { ClaimEvent, ClaimRecord, ClaimStage } from '../contracts/index.js';

const ACTIVE: readonly ClaimStage[] = ['Triage', 'Assessment', 'Negotiation', 'Approved', 'Settlement'];

/**
 * The stages a claim in `from` may move to. A closed claim comes back only through an explicit Reopened event, which
 * returns it to an active stage or closes it again. Any other claim may move to any later or earlier stage except New
 * and Reopened, because the fixtures themselves skip stages (New to Closed). The stage it is already in is never a
 * move: it would restart the stage clock with no change.
 */
export function nextStages(from: ClaimStage): ClaimStage[] {
  if (from === 'Closed') return ['Reopened'];
  if (from === 'Reopened') return [...ACTIVE, 'Closed'];
  return CLAIM_STAGES.filter((stage) => stage !== from && stage !== 'New' && stage !== 'Reopened');
}

/** Ties with a real event stamped 23:59:59 on the same day go to the larger id, and `~` sorts after letters and digits. */
const WHAT_IF_EVENT_ID = '~what-if';

/**
 * The claim with one stage event appended at the end of the as-of day (Africa/Gaborone), so it is the latest event
 * however late that day a real one was recorded; the stage clock counts from the as-of date. The record fields the
 * event would change (recorded stage, status, closed date) move with it, so the engine's reconcile check and its open
 * or closed reading agree. Reopening keeps the earlier closed date.
 */
export function withHypotheticalStage(claim: ClaimRecord, to: ClaimStage, from: ClaimStage, asOf: string): ClaimRecord {
  const event: ClaimEvent = {
    tenant_id: claim.tenant_id,
    event_id: WHAT_IF_EVENT_ID,
    claim_id: claim.claim_id,
    event_at: endOfDay(asOf),
    from_stage: from,
    to_stage: to,
    reason: 'What-if: not saved',
    actor_id: claim.handler_id,
  };
  return {
    ...claim,
    stage: to,
    status: to === 'Closed' ? 'CLOSED' : 'OPEN',
    closed_at: to === 'Closed' ? asOf : claim.closed_at,
    events: [...claim.events, event],
  };
}
