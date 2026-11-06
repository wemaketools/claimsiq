/**
 * What a figure on Overview or Stages & Aging counts, as a criterion that travels in the URL of the Claims page
 * (`/claims?show=stage:Assessment`) and selects exactly those claims from the engine's facts. A criterion only selects;
 * every figure itself comes from the rules engine.
 */
import { CLAIM_STAGES, compareMoney } from '../../../../contracts/index';
import type { ClaimFacts, ClaimStage } from '../../../../contracts/index';
import { t } from '../../lib/i18n';

export const CLAIMS_PATH = '/claims';
export const CRITERION_PARAM = 'show';
export const UNKNOWN = 'unknown';

type Plain =
  | 'open'
  | 'closed'
  | 'sla-breached'
  | 'high-value'
  | 'high-priority'
  | 'paid'
  | 'reserve'
  | 'incurred'
  | 'new-in-period'
  | 'paid-in-period'
  | 'closed-in-period';
const PLAIN: readonly Plain[] = [
  'open',
  'closed',
  'sla-breached',
  'high-value',
  'high-priority',
  'paid',
  'reserve',
  'incurred',
  'new-in-period',
  'paid-in-period',
  'closed-in-period',
];
const OPEN_STAGES = CLAIM_STAGES.filter((stage) => stage !== 'Closed');

export type ClaimCriterion =
  | { readonly kind: Plain }
  | { readonly kind: 'stage'; readonly stage: ClaimStage | typeof UNKNOWN }
  | { readonly kind: 'age'; readonly bucket: string };

export function criterionValue(criterion: ClaimCriterion): string {
  switch (criterion.kind) {
    case 'stage':
      return `stage:${criterion.stage}`;
    case 'age':
      return `age:${criterion.bucket}`;
    default:
      return criterion.kind;
  }
}

/** The Claims page listing exactly the claims a figure counts. */
export function claimsLink(criterion: ClaimCriterion): string {
  return `${CLAIMS_PATH}?${CRITERION_PARAM}=${encodeURIComponent(criterionValue(criterion))}`;
}

/** The criterion in a URL value, or `null` when there is none or it is not one this app writes. */
export function parseCriterion(value: string | null): ClaimCriterion | null {
  if (value === null) return null;
  const plain = PLAIN.find((kind) => kind === value);
  if (plain !== undefined) return { kind: plain };
  const [kind, ...rest] = value.split(':');
  const argument = rest.join(':');
  if (kind === 'stage') {
    const stage = OPEN_STAGES.find((candidate) => candidate === argument);
    if (stage !== undefined) return { kind: 'stage', stage };
    return argument === UNKNOWN ? { kind: 'stage', stage: UNKNOWN } : null;
  }
  if (kind === 'age' && argument !== '') return { kind: 'age', bucket: argument };
  return null;
}

const positive = (amount: string): boolean => compareMoney(amount, '0.00') > 0;

export function matchesCriterion(criterion: ClaimCriterion, fact: ClaimFacts): boolean {
  switch (criterion.kind) {
    case 'open':
      return fact.is_open;
    case 'closed':
      return !fact.is_open;
    case 'sla-breached':
      return fact.is_open && fact.sla?.status === 'breached';
    case 'high-value':
      return fact.is_open && fact.high_value;
    case 'high-priority':
      return fact.is_open && fact.severity === 'High';
    case 'new-in-period':
      return fact.reported_in_period;
    case 'paid-in-period':
      return positive(fact.paid_in_period);
    case 'closed-in-period':
      return fact.closed_in_period;
    case 'paid':
      return positive(fact.paid);
    case 'reserve':
      return positive(fact.reserve);
    case 'incurred':
      return positive(fact.incurred);
    case 'stage':
      return (
        fact.is_open &&
        (criterion.stage === UNKNOWN
          ? fact.current_stage === null
          : fact.current_stage === criterion.stage)
      );
    case 'age':
      return (
        fact.is_open &&
        (criterion.bucket === UNKNOWN
          ? fact.age_days === null
          : fact.age_bucket === criterion.bucket)
      );
  }
}

export function ageBucketLabel(bucket: string): string {
  return bucket === UNKNOWN
    ? t('claim-scope.age.unknown')
    : t('claim-scope.age.bucket', { bucket });
}

export function stageLabel(stage: ClaimStage | null): string {
  return t(`claim-scope.stage.${stage ?? UNKNOWN}`);
}

export function describeCriterion(criterion: ClaimCriterion): string {
  switch (criterion.kind) {
    case 'stage':
      return criterion.stage === UNKNOWN
        ? t('claim-scope.criteria.stageUnknown')
        : t('claim-scope.criteria.stage', { stage: stageLabel(criterion.stage) });
    case 'age':
      return criterion.bucket === UNKNOWN
        ? t('claim-scope.criteria.ageUnknown')
        : t('claim-scope.criteria.age', { age: ageBucketLabel(criterion.bucket) });
    default:
      return t(`claim-scope.criteria.${criterion.kind}`);
  }
}
