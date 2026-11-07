/** Posted claim payments over time: what the rules engine says was paid in each calendar month up to the as-of date. */
import { z } from 'zod';

import { DateOnly, Money } from './primitives.js';

const Days = z.number().int().min(0);

export const PaidBucket = z.object({
  /** The calendar month, `2026-10`. */
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  /** First and last day counted: the 1st, and the last day of the month or the as-of date, whichever comes first. */
  from: DateOnly,
  to: DateOnly,
  /** Posted payments dated in the month. A month with none is a bucket of 0.00, not a gap. */
  paid: Money,
  payments: Days,
  /** Distinct claims those payments were on. */
  claims: Days,
});
export type PaidBucket = z.infer<typeof PaidBucket>;

export const PaidTrend = z.object({
  /** The posted paid to date of the claims in view: the sum of the buckets. */
  total: Money,
  payments: Days,
  /** From the month of the first posted payment to the as-of month, oldest first; empty when nothing was paid. */
  buckets: z.array(PaidBucket),
});
export type PaidTrend = z.infer<typeof PaidTrend>;
