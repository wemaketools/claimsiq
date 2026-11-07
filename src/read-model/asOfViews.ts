/** The records of a data set as an as-of date sees them: the one place that limits claims and their children. */
import { onOrBeforeAsOf } from '../contracts/index.js';
import type { ClaimRecord, InvoiceRecord } from '../contracts/index.js';
import type { DatasetRecords } from './fixtures/index.js';

/** What the as-of views need of a data set: its records. Tasks are not limited by the as-of date and come from their own source. */
export interface RecordSet {
  readonly records: Omit<DatasetRecords, 'task'>;
}

export const within = (asOf: string, moment: string | null): boolean => moment === null || onOrBeforeAsOf(moment, asOf);

function byKey<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const list = grouped.get(key(item));
    if (list === undefined) grouped.set(key(item), [item]);
    else list.push(item);
  }
  return grouped;
}

export function claimRecords(data: RecordSet, asOf: string, claimId?: string): ClaimRecord[] {
  const { claim, claim_event, reserve_event, claim_payment, supplier_request } = data.records;
  const claims = claim.filter(
    (row) => (claimId === undefined || row.claim_id === claimId) && within(asOf, row.reported_at),
  );
  const wanted = new Set(claims.map((row) => row.claim_id));
  const ofWanted = <T extends { claim_id: string }>(rows: readonly T[]): Map<string, T[]> =>
    byKey(rows.filter((row) => wanted.has(row.claim_id)), (row) => row.claim_id);
  const events = ofWanted(claim_event);
  const reserves = ofWanted(reserve_event);
  const payments = ofWanted(claim_payment);
  const requests = ofWanted(supplier_request);
  return claims.map((row) => ({
    ...row,
    events: (events.get(row.claim_id) ?? []).filter((e) => within(asOf, e.event_at)),
    reserve_events: (reserves.get(row.claim_id) ?? []).filter((e) => within(asOf, e.event_at)),
    payments: (payments.get(row.claim_id) ?? []).filter((p) => within(asOf, p.paid_at)),
    supplier_requests: (requests.get(row.claim_id) ?? []).filter((r) => within(asOf, r.requested_at)),
  }));
}

export function invoiceRecords(data: RecordSet, asOf: string): InvoiceRecord[] {
  const { invoice, payment_allocation, receipt, payment_attempt } = data.records;
  const receiptsById = new Map(receipt.filter((row) => within(asOf, row.received_at)).map((row) => [row.receipt_id, row]));
  const allocations = byKey(
    payment_allocation.filter((row) => within(asOf, row.posted_at) && receiptsById.has(row.receipt_id)),
    (row) => row.invoice_id,
  );
  const attempts = byKey(payment_attempt.filter((row) => within(asOf, row.attempt_at)), (row) => row.invoice_id);
  return invoice.map((row) => {
    const own = allocations.get(row.invoice_id) ?? [];
    const ownReceipts = [...new Set(own.map((a) => a.receipt_id))].flatMap((id) => receiptsById.get(id) ?? []);
    return { ...row, allocations: own, receipts: ownReceipts, payment_attempts: attempts.get(row.invoice_id) ?? [] };
  });
}
