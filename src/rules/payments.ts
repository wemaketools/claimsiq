/** The payments that count as paid at an as-of date: posted ones dated on or before it. Approved, pending, void and rejected never do. */
import { onOrBeforeAsOf } from '../contracts/index.js';
import type { ClaimPayment, ClaimRecord } from '../contracts/index.js';

export function postedPayments(claim: ClaimRecord, asOf: string): ClaimPayment[] {
  return claim.payments.filter((payment) => payment.status === 'POSTED' && onOrBeforeAsOf(payment.paid_at, asOf));
}
