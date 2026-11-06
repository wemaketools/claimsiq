/**
 * Why the engine flagged a claim, in words: each reason names its rule and the data that triggered it. The engine
 * decides; this only reads the reasons and facts it returned.
 */
import { SEVERITY_RULES, formatMoney } from '../../../../contracts/index';
import type {
  ClaimFacts,
  ReserveMovementFact,
  Severity,
  SeverityReason,
  SeverityRule,
} from '../../../../contracts/index';
import { t } from '../../lib/i18n';
import { stageLabel } from './criteria';

/** A rule of the engine, or the high-value flag that stands alone (it is a flag, not a rule with a severity). */
export type ReasonKey = SeverityRule | 'HIGH_VALUE';
export const REASON_KEYS: readonly ReasonKey[] = [...SEVERITY_RULES, 'HIGH_VALUE'];

export interface ClaimReason {
  readonly key: ReasonKey;
  /** `null` for the high-value flag. */
  readonly severity: Severity | null;
  readonly label: string;
  /** The trigger data in words, for example "Assessment: 7 business days over a 5-day target". */
  readonly text: string;
}

const RANK: Readonly<Record<Severity, number>> = { High: 3, Medium: 2, Low: 1 };

export const reasonLabel = (key: ReasonKey): string => t(`claim-scope.reason.${key}.label`);

const number = (value: unknown): number => (typeof value === 'number' ? value : 0);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function latestMaterial(fact: ClaimFacts): ReserveMovementFact | undefined {
  return fact.reserve_movements.filter((movement) => movement.material).at(-1);
}

/** The test that made a reserve movement material, for example "at least 30% of the earlier amount". */
export function materialBasis(movement: ReserveMovementFact): string {
  return movement.material_by === 'PERCENT'
    ? t('claim-scope.reason.reserve.byPercent', { percent: movement.threshold_percent })
    : t('claim-scope.reason.reserve.byAmount', { amount: formatMoney(movement.threshold_amount) });
}

function reserveText(reason: SeverityReason, fact: ClaimFacts): string {
  const movement = latestMaterial(fact);
  const age = number(reason.trigger.age_days);
  const limit = number(reason.trigger.high_after_age_days);
  const aged = reason.rule === 'RESERVE_CHANGE_AGED';
  const moved =
    movement === undefined
      ? ''
      : t('claim-scope.reason.reserve.moved', {
          old: formatMoney(movement.old_amount),
          new: formatMoney(movement.new_amount),
          direction: t(
            `claim-scope.reason.reserve.${movement.kind === 'DECREASE' ? 'down' : 'up'}`,
          ),
          change: formatMoney(movement.change_amount),
          basis: materialBasis(movement),
        });
  return `${moved}${t(aged ? 'claim-scope.reason.reserve.aged' : 'claim-scope.reason.reserve.young', { age, limit })}`;
}

function triggerText(reason: SeverityReason, fact: ClaimFacts): string {
  const { trigger } = reason;
  const stage = stageLabel(fact.sla?.stage ?? null);
  switch (reason.rule) {
    case 'SLA_LATE':
    case 'SLA_BREACH':
      return t('claim-scope.reason.sla.over', {
        stage,
        count: number(trigger.business_days_over),
        target: number(trigger.target_business_days),
      });
    case 'SLA_APPROACHING':
      return t('claim-scope.reason.sla.approaching', {
        stage,
        spent: number(trigger.business_days_in_stage),
        target: number(trigger.target_business_days),
        left: number(trigger.business_days_left),
      });
    case 'SLA_UNKNOWN':
      return t('claim-scope.reason.sla.unknown', {
        stage,
        why: t(`claim-scope.reason.sla.why.${text(trigger.unknown_reason) || 'NO_STAGE_EVENT'}`),
      });
    case 'SUPPLIER_DELAY':
      return t('claim-scope.reason.supplier.delay', {
        request: text(trigger.request_id),
        waited: number(trigger.business_days_waited),
        target: number(trigger.target_business_days),
      });
    case 'SUPPLIER_UNVERIFIED':
      return t('claim-scope.reason.supplier.unverified', { request: text(trigger.request_id) });
    case 'HIGH_VALUE_DELAYED':
      return t('claim-scope.reason.highValue.delayed', {
        incurred: formatMoney(text(trigger.incurred)),
        threshold: formatMoney(text(trigger.high_value_incurred)),
      });
    case 'RESERVE_CHANGE':
    case 'RESERVE_CHANGE_AGED':
      return reserveText(reason, fact);
  }
}

/** The stage clock in words, or `null` for a closed claim, which has none. */
export function slaSummary(fact: ClaimFacts): string | null {
  const { sla } = fact;
  if (sla === null) return null;
  const stage = stageLabel(sla.stage);
  switch (sla.status) {
    case 'breached':
      return t('claim-scope.reason.sla.over', {
        stage,
        count: sla.business_days_over ?? 0,
        target: sla.target_business_days ?? 0,
      });
    case 'approaching':
      return t('claim-scope.reason.sla.approaching', {
        stage,
        spent: sla.business_days_in_stage ?? 0,
        target: sla.target_business_days ?? 0,
        left: sla.business_days_left ?? 0,
      });
    case 'within':
      return t('claim-scope.reason.sla.within', {
        stage,
        spent: sla.business_days_in_stage ?? 0,
        target: sla.target_business_days ?? 0,
      });
    case 'unknown':
      return t('claim-scope.reason.sla.unknown', {
        stage,
        why: t(`claim-scope.reason.sla.why.${sla.unknown_reason ?? 'NO_STAGE_EVENT'}`),
      });
  }
}

/** Highest severity first (the engine's order within a severity). A high-value flag with no delay comes last. */
export function claimReasons(fact: ClaimFacts): ClaimReason[] {
  const reasons: ClaimReason[] = [...fact.severity_reasons]
    .sort((a, b) => RANK[b.severity] - RANK[a.severity])
    .map((reason) => ({
      key: reason.rule,
      severity: reason.severity,
      label: reasonLabel(reason.rule),
      text: triggerText(reason, fact),
    }));
  if (fact.high_value && !reasons.some((reason) => reason.key === 'HIGH_VALUE_DELAYED')) {
    reasons.push({
      key: 'HIGH_VALUE',
      severity: null,
      label: reasonLabel('HIGH_VALUE'),
      text: t('claim-scope.reason.highValue.flag', { incurred: formatMoney(fact.incurred) }),
    });
  }
  return reasons;
}

/** Business days late: the larger of the stage clock's and any delayed supplier request's; null when nothing is late. */
export function daysLate(fact: ClaimFacts): number | null {
  const overdue = [
    fact.sla?.business_days_over ?? null,
    ...fact.supplier_waits.map((wait) => wait.business_days_over),
  ].filter((days): days is number => days !== null);
  return overdue.length === 0 ? null : Math.max(...overdue);
}
