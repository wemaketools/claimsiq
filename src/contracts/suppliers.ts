/**
 * What the rules engine says about each supplier's work on the open claims in view. Waits are business
 * days; an average is `null` below the minimum sample, so a screen has no average to compare on too few requests.
 */
import { z } from 'zod';

import type { ClaimFacts } from './facts.js';
import { Id } from './primitives.js';

const Count = z.number().int().min(0);

/** The requests behind an average: how many there were, and the mean when there were enough of them (`null` otherwise). */
const Sampled = z.object({ sample: Count, average: z.number().nullable() });

export const SupplierInsight = z.object({
  supplier_id: Id,
  /** Requests sent to the supplier on open claims that are not completed at the as-of date, with or without a request time. */
  open_requests: Count,
  /** Open requests with a request time, so a wait can be counted; their mean wait in business days. */
  wait: Sampled.extend({ longest: Count.nullable() }),
  /** Open requests waiting longer than the supplier target. */
  breaches: Count,
  /** Open requests with no request time: the wait cannot be judged, so they are neither within target nor a breach. */
  unverified: Count,
  /** Open claims assigned to the supplier. */
  open_assigned_cases: Count,
  /** Overdue, not-done tasks on the claims behind the supplier's figures. */
  late_actions: Count,
  /** Requests the supplier completed (on open claims) and their mean business days from request to completion. */
  turnaround: Sampled,
  /** Open claims assigned to the supplier or holding a request to it: the cases that make up the figures above. */
  cases: Count,
});
export type SupplierInsight = z.infer<typeof SupplierInsight>;

export const SupplierInsights = z.object({
  /** An average is shown only from this many requests. */
  min_sample: Count,
  target_business_days: Count,
  items: z.array(SupplierInsight),
});
export type SupplierInsights = z.infer<typeof SupplierInsights>;

/** Whether an open claim is one of the supplier's cases: assigned to it, or holding a request to it. */
export function isSupplierCase(fact: ClaimFacts, supplierId: string): boolean {
  return (
    fact.is_open &&
    (fact.supplier_id === supplierId || fact.supplier_waits.some((wait) => wait.supplier_id === supplierId))
  );
}
