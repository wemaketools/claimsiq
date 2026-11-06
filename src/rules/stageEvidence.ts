/** What a claim's stage events say at a moment, as the closure rules read them. */
import { chronological, dateOf } from '../contracts/index.js';
import type { ClaimEvent } from '../contracts/index.js';

export interface StageEvidence {
  /** The latest dated event at or before the moment; ties on time go to the larger event id. */
  readonly latest: ClaimEvent | undefined;
  /** A Closed event with no time: it exists but cannot be placed in order. */
  readonly undatedClosure: boolean;
}

export function stageEvidenceAt(events: readonly ClaimEvent[], moment: string): StageEvidence {
  const day = dateOf(moment);
  return {
    latest: chronological(
      events.filter((event) => event.event_at !== null && dateOf(event.event_at) <= day),
      (event) => event.event_at ?? '',
      (event) => event.event_id,
    ).at(-1),
    undatedClosure: events.some((event) => event.event_at === null && event.to_stage === 'Closed'),
  };
}
