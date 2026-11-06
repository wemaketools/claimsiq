/** The facts about one claim as of a date. Pure: the same claim record, date and config always give the same facts. */
import { Decimal } from 'decimal.js';

import { addMoney, compareMoney, momentMs, onOrBeforeAsOf, sumMoney } from '../contracts/index.js';
import type {
  ClaimFacts,
  ClaimRecord,
  PeriodOption,
  ReconcileStatus,
  ReserveEvent,
  ReserveMovementFact,
  Severity,
  SeverityReason,
  SlaFact,
  SupplierRequest,
  SupplierWaitFact,
} from '../contracts/index.js';
import { businessDaysBetween, calendarDaysBetween, weekdaySet } from './calendar.js';
import type { RuleConfig } from './config.js';
import { postedPayments } from './payments.js';
import { inPeriod, periodWindow } from './period.js';

export interface RuleContext {
  readonly asOf: string;
  readonly config: RuleConfig;
  /** The window of the period figures; the last 30 days when absent. */
  readonly period?: PeriodOption | undefined;
}

const SEVERITY_RANK: Readonly<Record<Severity, number>> = { High: 3, Medium: 2, Low: 1 };

/** Oldest first; two events at the same time are ordered by id, so the order never depends on the input order. */
function chronological<T>(items: readonly T[], at: (item: T) => string, id: (item: T) => string): T[] {
  return [...items].sort((a, b) => momentMs(at(a)) - momentMs(at(b)) || (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0));
}

export function ageBucketLabel(bounds: readonly number[], days: number): string {
  const index = bounds.findIndex((upper) => days <= upper);
  if (index === -1) {
    return `>${bounds[bounds.length - 1] ?? 0}`;
  }
  return `${index === 0 ? 0 : (bounds[index - 1] ?? 0) + 1}-${bounds[index] ?? 0}`;
}

function reconcile(comparable: boolean, known: boolean, same: boolean): ReconcileStatus {
  if (!known) return 'UNKNOWN';
  if (!comparable) return 'NOT_COMPARABLE';
  return same ? 'MATCHES' : 'DIFFERS';
}

function reserveMovements(events: readonly ReserveEvent[], context: RuleContext): ReserveMovementFact[] {
  const { material_reserve_delta_absolute_BWP: absolute, material_reserve_delta_percent: percent } = context.config.claims;
  return events.map((event, index) => {
    const before = new Decimal(event.old_amount);
    const change = new Decimal(event.new_amount).minus(before);
    const size = change.abs();
    const initial = index === 0 && before.isZero();
    const kind = initial ? 'INITIAL' : change.isZero() ? 'UNCHANGED' : change.isPositive() ? 'INCREASE' : 'DECREASE';
    const byAmount = size.gte(absolute);
    const byPercent = before.gt(0) && size.times(100).gte(before.times(percent));
    const material = !initial && !size.isZero() && (byAmount || byPercent);
    return {
      reserve_event_id: event.reserve_event_id,
      event_at: event.event_at,
      old_amount: event.old_amount,
      new_amount: event.new_amount,
      kind,
      change_amount: size.toFixed(2),
      change_percent: before.gt(0) ? size.div(before).times(100).toDecimalPlaces(1).toNumber() : null,
      material,
      material_by: material ? (byAmount ? 'AMOUNT' : 'PERCENT') : null,
      threshold_amount: new Decimal(absolute).toFixed(2),
      threshold_percent: percent,
      reason: event.reason,
    };
  });
}

function supplierWaits(requests: readonly SupplierRequest[], context: RuleContext, weekdays: ReadonlySet<number>): SupplierWaitFact[] {
  const target = context.config.claims.supplier_wait_target_business_days;
  return requests.map((request) => {
    const completed = request.completed_at !== null && onOrBeforeAsOf(request.completed_at, context.asOf);
    const base = {
      request_id: request.request_id,
      supplier_id: request.supplier_id,
      request_type: request.request_type,
      requested_at: request.requested_at,
      completed_at: completed ? request.completed_at : null,
      target_business_days: target,
    };
    if (request.requested_at === null) {
      return { ...base, status: 'unverified', business_days_waited: null, business_days_over: null };
    }
    const until = completed && request.completed_at !== null ? request.completed_at : context.asOf;
    const waited = businessDaysBetween(request.requested_at, until, weekdays);
    if (completed) {
      return { ...base, status: 'completed', business_days_waited: waited, business_days_over: null };
    }
    return waited > target
      ? { ...base, status: 'delayed', business_days_waited: waited, business_days_over: waited - target }
      : { ...base, status: 'within', business_days_waited: waited, business_days_over: null };
  });
}

function stageSla(
  stage: ClaimFacts['current_stage'],
  startedAt: string | null,
  undatedEvents: number,
  recordedStage: ClaimFacts['recorded_stage'],
  context: RuleContext,
  weekdays: ReadonlySet<number>,
): SlaFact {
  const { stage_sla_business_days: targets, approaching_window_business_days: window } = context.config.claims;
  const unknown = (reason: NonNullable<SlaFact['unknown_reason']>, target: number | null = null): SlaFact => ({
    status: 'unknown',
    stage: stage ?? recordedStage,
    target_business_days: target,
    stage_started_at: startedAt,
    business_days_in_stage: null,
    business_days_over: null,
    business_days_left: null,
    unknown_reason: reason,
  });
  if (stage === null || startedAt === null) return unknown('NO_STAGE_EVENT');
  if (undatedEvents > 0) return unknown('MISSING_EVENT_TIME', targets[stage] ?? null);
  const target = targets[stage];
  if (target === undefined) return unknown('NO_TARGET_FOR_STAGE');
  const spent = businessDaysBetween(startedAt, context.asOf, weekdays);
  const left = target - spent;
  const status = left < 0 ? 'breached' : left <= window ? 'approaching' : 'within';
  return {
    status,
    stage,
    target_business_days: target,
    stage_started_at: startedAt,
    business_days_in_stage: spent,
    business_days_over: left < 0 ? -left : null,
    business_days_left: left < 0 ? null : left,
    unknown_reason: null,
  };
}

function severityReasons(
  facts: Pick<ClaimFacts, 'sla' | 'supplier_waits' | 'supplier_delayed' | 'supplier_delay_unverified' | 'material_reserve_change' | 'high_value' | 'age_days' | 'incurred'>,
  context: RuleContext,
): SeverityReason[] {
  const { severity_high_sla_days_late: lateDays, severity_high_reserve_change_min_age_days: minAge, high_value_incurred_BWP: highValue } =
    context.config.claims;
  const { sla } = facts;
  const reasons: SeverityReason[] = [];
  const sla_trigger = {
    stage: sla?.stage ?? null,
    target_business_days: sla?.target_business_days ?? null,
    business_days_in_stage: sla?.business_days_in_stage ?? null,
  };
  if (sla?.status === 'breached') {
    const late = (sla.business_days_over ?? 0) > lateDays;
    reasons.push({
      rule: late ? 'SLA_LATE' : 'SLA_BREACH',
      severity: late ? 'High' : 'Medium',
      trigger: { ...sla_trigger, business_days_over: sla.business_days_over, high_after_days_late: lateDays },
    });
  } else if (sla?.status === 'approaching') {
    reasons.push({ rule: 'SLA_APPROACHING', severity: 'Low', trigger: { ...sla_trigger, business_days_left: sla.business_days_left } });
  } else if (sla?.status === 'unknown') {
    reasons.push({ rule: 'SLA_UNKNOWN', severity: 'Low', trigger: { stage: sla.stage, unknown_reason: sla.unknown_reason } });
  }
  const delayedWait = facts.supplier_waits.find((wait) => wait.status === 'delayed');
  if (facts.supplier_delayed) {
    reasons.push({
      rule: 'SUPPLIER_DELAY',
      severity: 'Medium',
      trigger: {
        request_id: delayedWait?.request_id ?? null,
        business_days_waited: delayedWait?.business_days_waited ?? null,
        target_business_days: delayedWait?.target_business_days ?? null,
      },
    });
  }
  if (facts.supplier_delay_unverified) {
    reasons.push({
      rule: 'SUPPLIER_UNVERIFIED',
      severity: 'Low',
      trigger: { request_id: facts.supplier_waits.find((wait) => wait.status === 'unverified')?.request_id ?? null },
    });
  }
  if (facts.high_value && (sla?.status === 'breached' || facts.supplier_delayed)) {
    reasons.push({
      rule: 'HIGH_VALUE_DELAYED',
      severity: 'High',
      trigger: { incurred: facts.incurred, high_value_incurred: new Decimal(highValue).toFixed(2) },
    });
  }
  if (facts.material_reserve_change) {
    const aged = facts.age_days !== null && facts.age_days > minAge;
    reasons.push({
      rule: aged ? 'RESERVE_CHANGE_AGED' : 'RESERVE_CHANGE',
      severity: aged ? 'High' : 'Low',
      trigger: { age_days: facts.age_days, high_after_age_days: minAge },
    });
  }
  return reasons;
}

export function computeClaimFacts(claim: ClaimRecord, context: RuleContext): ClaimFacts {
  const { asOf, config } = context;
  const weekdays = weekdaySet(config.claims.business_days);
  const comparable = asOf >= config.as_of;

  const events = claim.events.filter((event) => event.event_at === null || onOrBeforeAsOf(event.event_at, asOf));
  const dated = chronological(
    events.filter((event) => event.event_at !== null),
    (event) => event.event_at ?? '',
    (event) => event.event_id,
  );
  const undatedEvents = events.length - dated.length;
  const latest = dated[dated.length - 1] ?? null;
  const currentStage = latest?.to_stage ?? null;
  const stageStartedAt = latest?.event_at ?? null;
  const isOpen = currentStage === null ? claim.status !== 'CLOSED' : currentStage !== 'Closed';

  const posted = postedPayments(claim, asOf);
  const paid = sumMoney(posted.map((payment) => payment.paid_amount));
  const reserveEvents = chronological(
    claim.reserve_events.filter((event) => onOrBeforeAsOf(event.event_at, asOf)),
    (event) => event.event_at,
    (event) => event.reserve_event_id,
  );
  const reserve = reserveEvents[reserveEvents.length - 1]?.new_amount ?? claim.current_outstanding_reserve;
  const incurred = addMoney(paid, reserve);
  const window = periodWindow(context.period, asOf);
  const paidInPeriod = sumMoney(posted.filter((payment) => inPeriod(payment.paid_at, window)).map((payment) => payment.paid_amount));

  const reportedAt = claim.reported_at;
  const ageDays = isOpen && reportedAt !== null ? calendarDaysBetween(reportedAt, asOf) : null;
  const closedAt = claim.closed_at !== null && onOrBeforeAsOf(claim.closed_at, asOf) ? claim.closed_at : null;
  const turnaround =
    !isOpen && reportedAt !== null && closedAt !== null ? calendarDaysBetween(reportedAt, closedAt) : null;

  const sla = isOpen ? stageSla(currentStage, stageStartedAt, undatedEvents, claim.stage, context, weekdays) : null;
  const waits = isOpen
    ? supplierWaits(
        claim.supplier_requests
          .filter((request) => request.requested_at === null || onOrBeforeAsOf(request.requested_at, asOf))
          .sort((a, b) => (a.requested_at ?? '').localeCompare(b.requested_at ?? '') || a.request_id.localeCompare(b.request_id)),
        context,
        weekdays,
      )
    : [];
  const movements = reserveMovements(reserveEvents, context);

  const partial = {
    sla,
    supplier_waits: waits,
    supplier_delayed: waits.some((wait) => wait.status === 'delayed'),
    supplier_delay_unverified: waits.some((wait) => wait.status === 'unverified'),
    material_reserve_change: movements.some((movement) => movement.material),
    high_value: compareMoney(incurred, new Decimal(config.claims.high_value_incurred_BWP).toFixed(2)) >= 0,
    age_days: ageDays,
    incurred,
  };
  const reasons = isOpen ? severityReasons(partial, context) : [];
  const severity = reasons.reduce<Severity | null>(
    (top, reason) => (top === null || SEVERITY_RANK[reason.severity] > SEVERITY_RANK[top] ? reason.severity : top),
    null,
  );

  return {
    claim_id: claim.claim_id,
    policy_id: claim.policy_id,
    handler_id: claim.handler_id,
    supplier_id: claim.supplier_id,
    recorded_stage: claim.stage,
    current_stage: currentStage,
    stage_started_at: stageStartedAt,
    stage_check: reconcile(comparable, currentStage !== null, currentStage === claim.stage),
    undated_events: undatedEvents,
    is_open: isOpen,
    reported_at: reportedAt,
    closed_at: closedAt,
    closed_turnaround_days: turnaround,
    paid,
    reserve,
    incurred,
    reported_in_period: inPeriod(reportedAt, window),
    closed_in_period: !isOpen && inPeriod(closedAt, window),
    paid_in_period: paidInPeriod,
    reserve_check: reconcile(comparable, reserveEvents.length > 0, compareMoney(reserve, claim.current_outstanding_reserve) === 0),
    age_days: ageDays,
    age_bucket: ageDays === null ? null : ageBucketLabel(config.claims.age_bucket_upper_days, ageDays),
    days_in_stage: isOpen && stageStartedAt !== null ? calendarDaysBetween(stageStartedAt, asOf) : null,
    sla: partial.sla,
    supplier_waits: waits,
    supplier_delayed: partial.supplier_delayed,
    supplier_delay_unverified: partial.supplier_delay_unverified,
    reserve_movements: movements,
    material_reserve_change: partial.material_reserve_change,
    high_value: partial.high_value,
    severity,
    severity_reasons: reasons,
  };
}
