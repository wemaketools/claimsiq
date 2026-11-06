/** Whether a claim is closed at a moment: the one place the engine reads a claim's open or closed state back in time. */
import { dateOf } from '../contracts/index.js';
import type { ClaimRecord } from '../contracts/index.js';
import { stageEvidenceAt } from './stageEvidence.js';

type ClosureEvidence = Pick<ClaimRecord, 'events' | 'closed_at'>;

/**
 * `closed` or `open` from the claim's own evidence, `unknown` when it has no dated stage event at or before the moment.
 * The latest dated stage event at or before the moment decides. An undated Closed event has no moment of its own, so
 * the claim's closed date stands in for it: closed from that date on, unless a later dated event moved the claim on.
 */
function closureAt(claim: ClosureEvidence, moment: string): 'closed' | 'open' | 'unknown' {
  const day = dateOf(moment);
  const { latest, undatedClosure } = stageEvidenceAt(claim.events, moment);
  if (latest === undefined) return 'unknown';
  if (latest.to_stage === 'Closed') return 'closed';
  if (!undatedClosure || claim.closed_at === null || dateOf(claim.closed_at) > day) return 'open';
  return dateOf(latest.event_at ?? '') <= dateOf(claim.closed_at) ? 'closed' : 'open';
}

/** With no dated stage event to read, the closed date decides. */
export function isClosedAt(claim: ClosureEvidence, moment: string): boolean {
  const closure = closureAt(claim, moment);
  return closure === 'unknown' ? claim.closed_at !== null && dateOf(claim.closed_at) <= dateOf(moment) : closure === 'closed';
}

/** With no dated stage event to read, the recorded status decides. */
export function isOpenAt(claim: ClosureEvidence & Pick<ClaimRecord, 'status'>, moment: string): boolean {
  const closure = closureAt(claim, moment);
  return closure === 'unknown' ? claim.status !== 'CLOSED' : closure !== 'closed';
}
