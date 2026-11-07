/** Portfolio totals over a list of claim facts: the whole tenant, or whatever subset a screen has filtered. */
import { Decimal } from 'decimal.js';

import { CLAIM_STAGES, compareMoney, sumMoney } from '../contracts/index.js';
import type { BreakdownRow, ClaimFacts, ClaimsSummary, MoneyTotals, PeriodSummary } from '../contracts/index.js';
import { ageBucketLabel } from './claimFacts.js';
import type { RuleContext } from './claimFacts.js';
import { periodWindow } from './period.js';

function totalsOf(facts: readonly ClaimFacts[]): MoneyTotals {
  return {
    paid: sumMoney(facts.map((fact) => fact.paid)),
    reserve: sumMoney(facts.map((fact) => fact.reserve)),
    incurred: sumMoney(facts.map((fact) => fact.incurred)),
  };
}

const counted = (facts: readonly ClaimFacts[]) => ({ count: facts.length, ...totalsOf(facts) });

function periodSummary(facts: readonly ClaimFacts[], context: RuleContext): PeriodSummary {
  const window = periodWindow(context.period, context.asOf);
  const closed = facts.filter((fact) => fact.closed_in_period);
  const turnarounds = closed.flatMap((fact) => (fact.closed_turnaround_days === null ? [] : [fact.closed_turnaround_days]));
  return {
    option: window.option,
    from: window.from,
    to: window.to,
    new_claims: facts.filter((fact) => fact.reported_in_period).length,
    paid: {
      amount: sumMoney(facts.map((fact) => fact.paid_in_period)),
      claims: facts.filter((fact) => compareMoney(fact.paid_in_period, '0.00') > 0).length,
    },
    closed: {
      count: closed.length,
      average_turnaround_days: averageDays(turnarounds),
      without_turnaround: closed.length - turnarounds.length,
      undated: facts.filter((fact) => !fact.is_open && fact.closed_at === null).length,
    },
    high_priority: facts.filter((fact) => fact.is_open && fact.severity === 'High').length,
  };
}

function averageDays(days: readonly number[]): number | null {
  return days.length === 0 ? null : new Decimal(days.reduce((total, value) => total + value, 0)).div(days.length).toDecimalPlaces(1).toNumber();
}

/** Open claims grouped by a key (the largest incurred first, then the larger count, then the key), with their money. */
export function breakdownOfOpenClaims(facts: readonly ClaimFacts[], keyOf: (fact: ClaimFacts) => string | null): BreakdownRow[] {
  const groups = new Map<string | null, ClaimFacts[]>();
  for (const fact of facts.filter((candidate) => candidate.is_open)) {
    const key = keyOf(fact);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [fact]);
    else group.push(fact);
  }
  return [...groups.entries()]
    .map(([id, group]) => ({ id, claims: group.length, ...totalsOf(group) }))
    .sort((a, b) => compareMoney(b.incurred, a.incurred) || b.claims - a.claims || Number(a.id === null) - Number(b.id === null) || (a.id ?? '').localeCompare(b.id ?? ''));
}

export function summarizeClaimFacts(facts: readonly ClaimFacts[], context: RuleContext): ClaimsSummary {
  const open = facts.filter((fact) => fact.is_open);
  const closed = facts.filter((fact) => !fact.is_open);
  const bounds = context.config.claims.age_bucket_upper_days;
  const bucketFacts = (label: string) => open.filter((fact) => fact.age_bucket === label);
  const turnarounds = closed.flatMap((fact) => (fact.closed_turnaround_days === null ? [] : [fact.closed_turnaround_days]));
  const slaCount = (status: string) => open.filter((fact) => fact.sla?.status === status).length;
  const severityCount = (severity: ClaimFacts['severity']) => open.filter((fact) => fact.severity === severity).length;

  return {
    as_of: context.asOf,
    period: periodSummary(facts, context),
    claims: facts.length,
    open: open.length,
    closed: closed.length,
    totals: totalsOf(facts),
    open_totals: totalsOf(open),
    by_stage: CLAIM_STAGES.map((stage) => ({ stage, ...counted(facts.filter((fact) => fact.current_stage === stage)) })),
    unknown_stage: counted(facts.filter((fact) => fact.current_stage === null)),
    open_unknown_stage: counted(open.filter((fact) => fact.current_stage === null)),
    by_age_bucket: [...bounds, null].map((upper, index) => {
      const from = index === 0 ? 0 : (bounds[index - 1] ?? 0) + 1;
      const label = ageBucketLabel(bounds, upper ?? (bounds[bounds.length - 1] ?? 0) + 1);
      return { bucket: label, from_days: from, to_days: upper, ...counted(bucketFacts(label)) };
    }),
    unknown_age: counted(open.filter((fact) => fact.age_days === null)),
    sla: { breached: slaCount('breached'), approaching: slaCount('approaching'), within: slaCount('within'), unknown: slaCount('unknown') },
    supplier_delayed_claims: open.filter((fact) => fact.supplier_delayed).length,
    supplier_delay_unverified_claims: open.filter((fact) => fact.supplier_delay_unverified).length,
    high_value_open_claims: open.filter((fact) => fact.high_value).length,
    material_reserve_change_open_claims: open.filter((fact) => fact.material_reserve_change).length,
    severity: { High: severityCount('High'), Medium: severityCount('Medium'), Low: severityCount('Low'), none: severityCount(null) },
    stage_mismatches: facts.filter((fact) => fact.stage_check === 'DIFFERS').length,
    average_closed_turnaround_days: averageDays(turnarounds),
    closed_without_turnaround: closed.length - turnarounds.length,
  };
}
