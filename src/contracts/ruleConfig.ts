/**
 * The claims rule config (`fixtures/v2/proposed_rule_config.json`), validated, and the part of it the rule editor
 * changes. The thresholds the spec states in prose but its config file does not carry (the approaching window, the
 * severity cut-offs and the age buckets) are optional fields with the spec's proposed values as defaults; the supplier
 * sample minimum is ours (the spec only asks that a small sample not mislead).
 */
import { z } from 'zod';

import { CLAIM_STAGES, ClaimStage } from './entities.js';
import { DateOnly } from './primitives.js';

export const BUSINESS_DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

const Count = z.number().int().min(0);
const Amount = z.number().min(0);

const AgeBucketBounds = z
  .array(Count)
  .min(1)
  .refine((bounds) => bounds.every((bound, index) => index === 0 || bound > (bounds[index - 1] ?? 0)), {
    message: 'age_bucket_upper_days must be strictly increasing',
  });

/** The values the rule editor changes, each with the rule its checks come from. */
const editableValues = {
  stage_sla_business_days: z.partialRecord(ClaimStage, Count),
  supplier_wait_target_business_days: Count,
  supplier_min_sample: z.number().int().min(1),
  material_reserve_delta_absolute_BWP: Amount,
  material_reserve_delta_percent: Amount,
  high_value_incurred_BWP: Amount,
  approaching_window_business_days: Count,
  severity_high_sla_days_late: Count,
  severity_high_reserve_change_min_age_days: Count,
  age_bucket_upper_days: AgeBucketBounds,
};

export const ClaimsRuleConfig = z.object({
  ...editableValues,
  business_days: z.array(z.enum(BUSINESS_DAY_CODES)).min(1),
  holidays_excluded: z.literal(false, { error: 'public holidays are not supported: holidays_excluded must be false' }),
  supplier_min_sample: editableValues.supplier_min_sample.default(2),
  approaching_window_business_days: editableValues.approaching_window_business_days.default(1),
  severity_high_sla_days_late: editableValues.severity_high_sla_days_late.default(2),
  severity_high_reserve_change_min_age_days: editableValues.severity_high_reserve_change_min_age_days.default(30),
  age_bucket_upper_days: editableValues.age_bucket_upper_days.default([7, 30, 60, 90]),
});

export const RuleConfig = z.object({
  /** The date the fixtures' recorded stage and reserve are as of; later as-of dates can be checked against them. */
  as_of: DateOnly,
  claims: ClaimsRuleConfig,
});
export type RuleConfig = z.infer<typeof RuleConfig>;

/**
 * What the rule editor sends: every value it can change, none left to a default. The working week and the holiday
 * calendar are the spec's documented demo simplification and are not editable.
 */
export const EditableClaimsRules = z.object(editableValues);
export type EditableClaimsRules = z.infer<typeof EditableClaimsRules>;

const STAGE_FIELD_PREFIX = 'stage_sla_business_days.';

/** The name of one stage's target among the rule values, as the audit trail and the editor use it. */
export const stageField = (stage: ClaimStage): string => `${STAGE_FIELD_PREFIX}${stage}`;

/** The stage a rule value name is the target of, or null for any other value. */
export function stageOfField(field: string): ClaimStage | null {
  const parsed = ClaimStage.safeParse(field.slice(STAGE_FIELD_PREFIX.length));
  return field.startsWith(STAGE_FIELD_PREFIX) && parsed.success ? parsed.data : null;
}

/** A value of the rule config as text, under the path the audit trail and the editor name it by. */
export interface RuleFieldValue {
  /** A key of `EditableClaimsRules`, or `stageField(stage)` for one stage's target. */
  readonly field: string;
  /** Numbers as written (`25000`), the age buckets as `7, 30, 60, 90`. */
  readonly value: string;
}

/**
 * The editable values of a claims rule config as text, in the order the editor lists them: the stage targets in stage
 * order, then the others as the schema lists them. The order never follows the object's own key order, which a
 * database may rearrange.
 */
export function ruleFieldValues(claims: EditableClaimsRules): RuleFieldValue[] {
  const stages = CLAIM_STAGES.flatMap((stage) => {
    const days = claims.stage_sla_business_days[stage];
    return days === undefined ? [] : [{ field: stageField(stage), value: String(days) }];
  });
  const others = (Object.keys(editableValues) as (keyof EditableClaimsRules)[])
    .filter((field) => field !== 'stage_sla_business_days')
    .map((field) => {
      const value = claims[field];
      return { field, value: Array.isArray(value) ? value.join(', ') : String(value) };
    });
  return [...stages, ...others];
}
