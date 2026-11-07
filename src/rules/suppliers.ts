/** Supplier insights: what each supplier's requests, cases and late actions look like over a list of claim facts. */
import { Decimal } from 'decimal.js';

import { isSupplierCase } from '../contracts/index.js';
import type { ClaimFacts, Supplier, SupplierInsight, SupplierInsights, Task, WaitPercentiles } from '../contracts/index.js';
import type { RuleContext } from './claimFacts.js';
import { nearestRank } from './percentile.js';
import { isTaskOverdue } from './tasks.js';

type LateTask = Pick<Task, 'subject_type' | 'subject_id' | 'status' | 'due_at'>;

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : new Decimal(values.reduce((total, value) => total + value, 0)).div(values.length).toDecimalPlaces(1).toNumber();
}

/** The median and 90th percentile of the waits, only from the minimum sample; below it they are `null`, and so is any placement against the target. */
function waitPercentiles(waits: readonly number[], minimum: number, target: number): WaitPercentiles {
  const placed = waits.length >= minimum;
  const median = placed ? nearestRank(waits, 50) : null;
  const p90 = placed ? nearestRank(waits, 90) : null;
  const against = (value: number | null) => (value === null ? null : value > target ? ('over' as const) : ('within' as const));
  return { sample: waits.length, median, p90, median_vs_target: against(median), p90_vs_target: against(p90) };
}

/**
 * One row per supplier, in the order given, never ranked. Only open claims have supplier waits, so closed claims
 * add nothing. A request whose wait cannot be counted (no request time) is open and unverified, not a sample.
 * An average or percentile needs at least `supplier_min_sample` requests behind it.
 */
export function summarizeSuppliers(
  suppliers: readonly Pick<Supplier, 'supplier_id'>[],
  facts: readonly ClaimFacts[],
  tasks: readonly LateTask[],
  context: RuleContext,
): SupplierInsights {
  const { supplier_wait_target_business_days: target, supplier_min_sample: minimum } = context.config.claims;
  const averageOf = (values: readonly number[]): number | null => (values.length >= minimum ? mean(values) : null);
  const overdueByClaim = new Map<string, number>();
  for (const task of tasks) {
    if (task.subject_type === 'CLAIM' && isTaskOverdue(task, context.asOf)) {
      overdueByClaim.set(task.subject_id, (overdueByClaim.get(task.subject_id) ?? 0) + 1);
    }
  }

  const allWaits: number[] = [];
  const items = suppliers.map((supplier): SupplierInsight => {
    const id = supplier.supplier_id;
    const cases = facts.filter((fact) => isSupplierCase(fact, id));
    const waits = cases.flatMap((fact) => fact.supplier_waits.filter((wait) => wait.supplier_id === id));
    const open = waits.filter((wait) => wait.status !== 'completed');
    const waited = open.flatMap((wait) => (wait.business_days_waited === null ? [] : [wait.business_days_waited]));
    allWaits.push(...waited);
    const turnarounds = waits.flatMap((wait) =>
      wait.status === 'completed' && wait.business_days_waited !== null ? [wait.business_days_waited] : [],
    );
    return {
      supplier_id: id,
      open_requests: open.length,
      wait: { sample: waited.length, average: averageOf(waited), longest: waited.length === 0 ? null : Math.max(...waited) },
      percentiles: waitPercentiles(waited, minimum, target),
      breaches: open.filter((wait) => wait.status === 'delayed').length,
      unverified: open.filter((wait) => wait.status === 'unverified').length,
      open_assigned_cases: facts.filter((fact) => fact.is_open && fact.supplier_id === id).length,
      late_actions: cases.reduce((total, fact) => total + (overdueByClaim.get(fact.claim_id) ?? 0), 0),
      turnaround: { sample: turnarounds.length, average: averageOf(turnarounds) },
      cases: cases.length,
    };
  });
  return { min_sample: minimum, target_business_days: target, all_suppliers: waitPercentiles(allWaits, minimum, target), items };
}
