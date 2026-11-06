/**
 * What the rules engine computes about a claim as of a date, and the portfolio totals over those facts. Every flag
 * is a review cue, never a verdict; unknown evidence is `unknown` or null, never good or bad.
 */
import { z } from 'zod';

import { ClaimStage } from './entities.js';
import { DateOnly, Id, Moment, Money } from './primitives.js';

const Days = z.number().int().min(0);

export const SLA_STATUSES = ['breached', 'approaching', 'within', 'unknown'] as const;
export const SlaStatus = z.enum(SLA_STATUSES);
export type SlaStatus = z.infer<typeof SlaStatus>;

export const SlaUnknownReason = z.enum(['NO_STAGE_EVENT', 'MISSING_EVENT_TIME', 'NO_TARGET_FOR_STAGE']);

export const SlaFact = z.object({
  status: SlaStatus,
  stage: ClaimStage,
  target_business_days: Days.nullable(),
  stage_started_at: Moment.nullable(),
  business_days_in_stage: Days.nullable(),
  /** Set when breached: business days in stage beyond the target. */
  business_days_over: Days.nullable(),
  /** Set when within or approaching: business days still available before the target is exceeded. */
  business_days_left: Days.nullable(),
  unknown_reason: SlaUnknownReason.nullable(),
});
export type SlaFact = z.infer<typeof SlaFact>;

export const SupplierWaitFact = z.object({
  request_id: Id,
  supplier_id: Id,
  request_type: z.string(),
  requested_at: Moment.nullable(),
  completed_at: Moment.nullable(),
  /** `unverified`: the request time is missing, so the delay cannot be judged. */
  status: z.enum(['delayed', 'within', 'unverified', 'completed']),
  /** Business days from the request to the completion, or to the as-of date while it is pending. */
  business_days_waited: Days.nullable(),
  target_business_days: Days,
  business_days_over: Days.nullable(),
});
export type SupplierWaitFact = z.infer<typeof SupplierWaitFact>;

export const ReserveMovementFact = z.object({
  reserve_event_id: Id,
  event_at: Moment,
  old_amount: Money,
  new_amount: Money,
  /** `INITIAL` is the first reserve set on a claim; it is not a movement and is never material. */
  kind: z.enum(['INITIAL', 'INCREASE', 'DECREASE', 'UNCHANGED']),
  change_amount: Money,
  /** Of the prior amount, one decimal; null when the prior amount is zero. */
  change_percent: z.number().nullable(),
  material: z.boolean(),
  reason: z.string(),
});
export type ReserveMovementFact = z.infer<typeof ReserveMovementFact>;

export const SEVERITIES = ['High', 'Medium', 'Low'] as const;
export const Severity = z.enum(SEVERITIES);
export type Severity = z.infer<typeof Severity>;

export const SEVERITY_RULES = [
  'SLA_LATE',
  'SLA_BREACH',
  'SLA_APPROACHING',
  'SLA_UNKNOWN',
  'SUPPLIER_DELAY',
  'SUPPLIER_UNVERIFIED',
  'HIGH_VALUE_DELAYED',
  'RESERVE_CHANGE_AGED',
  'RESERVE_CHANGE',
] as const;
export const SeverityRule = z.enum(SEVERITY_RULES);
export type SeverityRule = z.infer<typeof SeverityRule>;

export const SeverityReason = z.object({
  rule: SeverityRule,
  severity: Severity,
  /** The numbers and ids that triggered the rule, for the evidence line. */
  trigger: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});
export type SeverityReason = z.infer<typeof SeverityReason>;

export const ReconcileStatus = z.enum(['MATCHES', 'DIFFERS', 'NOT_COMPARABLE', 'UNKNOWN']);
export type ReconcileStatus = z.infer<typeof ReconcileStatus>;

export const ClaimFacts = z.object({
  claim_id: Id,
  policy_id: Id,
  handler_id: Id,
  supplier_id: Id.nullable(),
  recorded_stage: ClaimStage,
  /** The latest dated stage event; null when the claim has none. */
  current_stage: ClaimStage.nullable(),
  stage_started_at: Moment.nullable(),
  /** Whether the stage derived from the events equals the recorded one; only comparable from the reference date on. */
  stage_check: ReconcileStatus,
  /** Events without a time cannot be ordered and are left out of the current stage. */
  undated_events: Days,
  is_open: z.boolean(),
  reported_at: Moment.nullable(),
  closed_at: Moment.nullable(),
  closed_turnaround_days: Days.nullable(),
  paid: Money,
  reserve: Money,
  incurred: Money,
  reserve_check: ReconcileStatus,
  age_days: Days.nullable(),
  /** Null for a closed claim and for an open claim without a reported date. */
  age_bucket: z.string().nullable(),
  /** Calendar days in the current stage. */
  days_in_stage: Days.nullable(),
  /** Null for a closed claim. */
  sla: SlaFact.nullable(),
  supplier_waits: z.array(SupplierWaitFact),
  supplier_delayed: z.boolean(),
  supplier_delay_unverified: z.boolean(),
  reserve_movements: z.array(ReserveMovementFact),
  material_reserve_change: z.boolean(),
  high_value: z.boolean(),
  /** Null for a closed claim and for an open claim nothing was triggered on. */
  severity: Severity.nullable(),
  severity_reasons: z.array(SeverityReason),
});
export type ClaimFacts = z.infer<typeof ClaimFacts>;

export const MoneyTotals = z.object({ paid: Money, reserve: Money, incurred: Money });
export type MoneyTotals = z.infer<typeof MoneyTotals>;

const Counted = MoneyTotals.extend({ count: Days });

export const ClaimsSummary = z.object({
  as_of: DateOnly,
  claims: Days,
  open: Days,
  closed: Days,
  totals: MoneyTotals,
  open_totals: MoneyTotals,
  /** Every stage in workflow order, Closed included, so the counts add up to `claims` with `unknown_stage`. */
  by_stage: z.array(Counted.extend({ stage: ClaimStage })),
  unknown_stage: Counted,
  /** Open claims by age; `to_days` null is the open-ended last bucket. */
  by_age_bucket: z.array(Counted.extend({ bucket: z.string(), from_days: Days, to_days: Days.nullable() })),
  unknown_age: Counted,
  sla: z.object({ breached: Days, approaching: Days, within: Days, unknown: Days }),
  supplier_delayed_claims: Days,
  supplier_delay_unverified_claims: Days,
  high_value_open_claims: Days,
  material_reserve_change_open_claims: Days,
  severity: z.object({ High: Days, Medium: Days, Low: Days, none: Days }),
  stage_mismatches: Days,
  average_closed_turnaround_days: z.number().nullable(),
  closed_without_turnaround: Days,
});
export type ClaimsSummary = z.infer<typeof ClaimsSummary>;
