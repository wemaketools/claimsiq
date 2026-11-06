/** Posted paid per calendar month: the same posted payments as `paid` in the facts, bucketed by their paid date. */
import { dateOf, sumMoney } from '../contracts/index.js';
import type { ClaimRecord, PaidBucket, PaidTrend } from '../contracts/index.js';
import { postedPayments } from './payments.js';

const monthOf = (date: string): string => date.slice(0, 7);

function nextMonth(month: string): string {
  const [year = 0, number = 1] = month.split('-').map(Number);
  return number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
}

function lastDayOf(month: string): string {
  const [year = 0, number = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
}

/**
 * One bucket per month from the first posted payment's month to the as-of month, none left out (a month with no
 * payment is 0.00). A payment is in the month of its Africa/Gaborone paid date; approved, pending, void, rejected and
 * later-dated payments are in no bucket, so the buckets add up to the claims' paid to date.
 */
export function paidTrend(claims: readonly ClaimRecord[], asOf: string): PaidTrend {
  const payments = claims.flatMap((claim) => postedPayments(claim, asOf).map((payment) => ({ claim_id: claim.claim_id, payment })));
  const byMonth = new Map<string, typeof payments>();
  for (const entry of payments) {
    const month = monthOf(dateOf(entry.payment.paid_at));
    byMonth.set(month, [...(byMonth.get(month) ?? []), entry]);
  }
  const first = [...byMonth.keys()].sort()[0];
  const buckets: PaidBucket[] = [];
  if (first !== undefined) {
    for (let month = first; month <= monthOf(asOf); month = nextMonth(month)) {
      const inMonth = byMonth.get(month) ?? [];
      const last = lastDayOf(month);
      buckets.push({
        month,
        from: `${month}-01`,
        to: last < asOf ? last : asOf,
        paid: sumMoney(inMonth.map((entry) => entry.payment.paid_amount)),
        payments: inMonth.length,
        claims: new Set(inMonth.map((entry) => entry.claim_id)).size,
      });
    }
  }
  return {
    total: sumMoney(buckets.map((bucket) => bucket.paid)),
    payments: payments.length,
    buckets,
  };
}
