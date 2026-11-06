/** Whether a claim is closed at a moment: the one place the engine reads a claim's state back in time. */
import { chronological, dateOf } from '../contracts/index.js';
import type { ClaimRecord } from '../contracts/index.js';

/** The latest dated stage event at or before the moment is Closed; with no dated events at all, the closed date decides. */
export function isClosedAt(claim: Pick<ClaimRecord, 'events' | 'closed_at'>, moment: string): boolean {
  const day = dateOf(moment);
  const dated = claim.events.filter((event) => event.event_at !== null);
  if (dated.length === 0) return claim.closed_at !== null && dateOf(claim.closed_at) <= day;
  const latest = chronological(
    dated.filter((event) => dateOf(event.event_at ?? '') <= day),
    (event) => event.event_at ?? '',
    (event) => event.event_id,
  ).at(-1);
  return latest?.to_stage === 'Closed';
}
