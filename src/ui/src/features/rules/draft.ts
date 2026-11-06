/** The editor's draft: every value as the text typed, turned into the claims rules the API takes, with the same checks the API makes. */
import { EditableClaimsRules, ruleFieldValues } from '../../../../contracts/index';
import { t } from '../../lib/i18n';
import { ruleFieldInfo } from './fields';

export type Draft = Readonly<Record<string, string>>;

export const draftOf = (claims: EditableClaimsRules): Draft =>
  Object.fromEntries(ruleFieldValues(claims).map(({ field, value }) => [field, value]));

const STAGE_PREFIX = 'stage_sla_business_days.';

function numberOf(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text);
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

/** The draft against the API's schema: the claims to save, or the first message of each value that is refused. */
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
    const isBuckets = field === 'age_bucket_upper_days';
    const notANumber = issue.code === 'invalid_type';
    errors[field] ??= notANumber
      ? t(isBuckets ? 'rules.error.buckets' : 'rules.error.number')
      : issue.message;
  }
  return { valid: false, errors };
}

/** The values of the draft that differ from the saved ones, in the editor's order; `25000.00` typed over `25000` is no change. */
export function changedFields(saved: Draft, draft: Draft): string[] {
  const checked = checkDraft(draft);
  const typed = checked.valid ? draftOf(checked.claims) : draft;
  return Object.keys(typed).filter((field) => typed[field] !== saved[field]);
}
