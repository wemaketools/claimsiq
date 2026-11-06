/** The editor's draft: every value as the text typed, turned into the claims rules the API takes, with the same checks the API makes. */
import type { z } from 'zod';

import { EditableClaimsRules, ruleFieldValues } from '../../../../contracts/index';
import { t } from '../../lib/i18n';
import { ruleFieldInfo } from './fields';

export type Draft = Readonly<Record<string, string>>;

export const draftOf = (claims: EditableClaimsRules): Draft =>
  Object.fromEntries(ruleFieldValues(claims).map(({ field, value }) => [field, value]));

const STAGE_PREFIX = 'stage_sla_business_days.';

const NUMBER = /^-?\d+(\.\d+)?$/;

/** Plain decimal text only: `Number` alone would take `0x10`, `1e3` and `Infinity`. */
function numberOf(text: string): number {
  const trimmed = text.trim();
  return NUMBER.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** The draft as the API takes it; a value that is not a number or a list of numbers becomes `NaN`, which the checks refuse. */
function claimsOf(draft: Draft): unknown {
  const stages = Object.entries(draft).filter(([field]) => field.startsWith(STAGE_PREFIX));
  const entries = Object.entries(draft)
    .filter(([field]) => !field.startsWith(STAGE_PREFIX))
    .map(([field, text]) => [
      field,
      ruleFieldInfo(field).kind === 'buckets'
        ? text.split(',').map((part) => numberOf(part))
        : numberOf(text),
    ]);
  return {
    stage_sla_business_days: Object.fromEntries(
      stages.map(([field, text]) => [field.slice(STAGE_PREFIX.length), numberOf(text)]),
    ),
    ...Object.fromEntries(entries),
  };
}

export type DraftCheck =
  | {
      readonly valid: true;
      readonly claims: EditableClaimsRules;
      readonly errors: Readonly<Record<string, never>>;
    }
  | { readonly valid: false; readonly errors: Readonly<Record<string, string>> };

/** The one place a schema problem becomes words for the page: every kind of problem has a message here, so no schema wording reaches the user. */
function messageOf(issue: z.core.$ZodIssue, field: string): string {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.expected === 'int') return t('rules.error.whole');
      return t(field === 'age_bucket_upper_days' ? 'rules.error.buckets' : 'rules.error.number');
    case 'too_small':
      return t('rules.error.min', { min: Number(issue.minimum) });
    case 'too_big':
      return t('rules.error.max', { max: Number(issue.maximum) });
    case 'custom':
      return t('rules.error.increasing');
    default:
      return t('rules.error.invalid');
  }
}

/** The draft against the API's schema: the claims to save, or the message for the first problem of each value. */
export function checkDraft(draft: Draft): DraftCheck {
  const checked = EditableClaimsRules.safeParse(claimsOf(draft));
  if (checked.success) {
    return { valid: true, claims: checked.data, errors: {} };
  }
  const errors: Record<string, string> = {};
  for (const issue of checked.error.issues) {
    const [first, second] = issue.path;
    const field =
      first === 'stage_sla_business_days' && second !== undefined
        ? `${STAGE_PREFIX}${String(second)}`
        : String(first);
    errors[field] ??= messageOf(issue, field);
  }
  return { valid: false, errors };
}

/** The values of the draft that differ from the saved ones, in the editor's order; `25000.00` typed over `25000` is no change. */
export function changedFields(saved: Draft, draft: Draft): string[] {
  const checked = checkDraft(draft);
  const typed = checked.valid ? draftOf(checked.claims) : draft;
  return Object.keys(typed).filter((field) => typed[field] !== saved[field]);
}
