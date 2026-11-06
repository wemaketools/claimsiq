/**
 * The rule config (`fixtures/v1/proposed_rule_config.json`), validated. Every threshold the engine uses is read from
 * here. The thresholds the spec states in prose but its config file does not carry (the approaching window, the
 * severity cut-offs and the age buckets) are optional fields with the spec's proposed values as defaults.
 */
import { z } from 'zod';

import { ClaimStage, DateOnly } from '../contracts/index.js';

export const BUSINESS_DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

const Count = z.number().int().min(0);
const Amount = z.number().min(0);

const AgeBucketBounds = z
  .array(Count)
  .min(1)
  .refine((bounds) => bounds.every((bound, index) => index === 0 || bound > (bounds[index - 1] ?? 0)), {
    message: 'age_bucket_upper_days must be strictly increasing',
  });

export const ClaimsRuleConfig = z.object({
  stage_sla_business_days: z.partialRecord(ClaimStage, Count),
  business_days: z.array(z.enum(BUSINESS_DAY_CODES)).min(1),
  holidays_excluded: z.literal(false, { error: 'public holidays are not supported: holidays_excluded must be false' }),
  supplier_wait_target_business_days: Count,
  material_reserve_delta_absolute_BWP: Amount,
  material_reserve_delta_percent: Amount,
  high_value_incurred_BWP: Amount,
  approaching_window_business_days: Count.default(1),
  severity_high_sla_days_late: Count.default(2),
  severity_high_reserve_change_min_age_days: Count.default(30),
  age_bucket_upper_days: AgeBucketBounds.default([7, 30, 60, 90]),
});

export const RuleConfig = z.object({
  /** The date the fixtures' recorded stage and reserve are as of; later as-of dates can be checked against them. */
  as_of: DateOnly,
  claims: ClaimsRuleConfig,
});
export type RuleConfig = z.infer<typeof RuleConfig>;

export function parseRuleConfig(input: unknown): RuleConfig {
  return RuleConfig.parse(input);
}
