/** How each rule value reads and is entered: its label, unit and group. A new editable rule is a type error until it is described here. */
import { formatMoney, ruleFieldValues, stageOfField } from '../../../../contracts/index';
import type { EditableClaimsRules } from '../../../../contracts/index';
import { t } from '../../lib/i18n';
import { stageLabel } from '../claim-scope';

export type RuleKind =
  'businessDays' | 'calendarDays' | 'requests' | 'money' | 'percent' | 'buckets';
export type RuleGroup = 'stages' | 'suppliers' | 'money' | 'severity';

export const RULE_GROUPS: readonly RuleGroup[] = ['stages', 'suppliers', 'money', 'severity'];

type Described = Exclude<keyof EditableClaimsRules, 'stage_sla_business_days'>;

const DESCRIBED: Readonly<
  Record<Described, { readonly kind: RuleKind; readonly group: RuleGroup }>
> = {
  supplier_wait_target_business_days: { kind: 'businessDays', group: 'suppliers' },
  supplier_min_sample: { kind: 'requests', group: 'suppliers' },
  material_reserve_delta_absolute_BWP: { kind: 'money', group: 'money' },
  material_reserve_delta_percent: { kind: 'percent', group: 'money' },
  high_value_incurred_BWP: { kind: 'money', group: 'money' },
  approaching_window_business_days: { kind: 'businessDays', group: 'severity' },
  severity_high_sla_days_late: { kind: 'businessDays', group: 'severity' },
  severity_high_reserve_change_min_age_days: { kind: 'calendarDays', group: 'severity' },
  age_bucket_upper_days: { kind: 'buckets', group: 'severity' },
};

export interface RuleFieldInfo {
  readonly field: string;
  readonly label: string;
  readonly hint: string | null;
  readonly kind: RuleKind;
  readonly group: RuleGroup;
}

function isDescribed(field: string): field is Described {
  return field in DESCRIBED;
}

export function ruleFieldInfo(field: string): RuleFieldInfo {
  const stage = stageOfField(field);
  if (stage !== null) {
    return {
      field,
      label: t('rules.field.stage', { stage: stageLabel(stage) }),
      hint: null,
      kind: 'businessDays',
      group: 'stages',
    };
  }
  if (!isDescribed(field)) {
    return { field, label: field, hint: null, kind: 'calendarDays', group: 'severity' };
  }
  return {
    field,
    label: t(`rules.field.${field}`),
    hint: t(`rules.hint.${field}`),
    ...DESCRIBED[field],
  };
}

/** The fields of a config in the editor's order. */
export function ruleFieldsOf(claims: EditableClaimsRules): RuleFieldInfo[] {
  return ruleFieldValues(claims).map(({ field }) => ruleFieldInfo(field));
}

/** A value as the screens read it: `P40,000.00`, `5 business days`, `30%`. A missing value reads "No target". */
export function formatRuleValue(kind: RuleKind, value: string | null): string {
  if (value === null) return t('rules.value.none');
  switch (kind) {
    case 'money':
      return formatMoney(value);
    case 'percent':
      return t('rules.value.percent', { value });
    case 'buckets':
      return t('rules.value.buckets', { value });
    default:
      return t(`rules.value.${kind}`, { count: Number(value) });
  }
}

export const unitOf = (kind: RuleKind): string | undefined =>
  kind === 'buckets' ? undefined : t(`rules.unit.${kind}`);
