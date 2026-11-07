/**
 * Test-only rows added to the TEST data set for the scenarios the shipped data has no row for. `fixtures/v1` is never
 * edited; the same rows reach each mode its own way:
 * - prototype: the SPA bundles the CSV text, so the page's script response is rewritten on its way in;
 * - stack: the rows are inserted into the local database, and taken out again afterwards (Reset would too).
 * A row whose anchor is not found in the bundle fails the test.
 */
import type { Page } from '@playwright/test';

import { withClient } from '../../scripts/db/connection';
import { isLocalUrl } from '../../scripts/db/localHost';
import { databaseUrl } from '../localEnv';

interface EventRow {
  readonly id: string;
  readonly claim: string;
  /** `null` is an event with no time recorded. */
  readonly at: string | null;
  readonly from: string;
  readonly to: string;
  readonly reason: string;
}

interface PaymentRow {
  readonly id: string;
  readonly claim: string;
  readonly paidAt: string;
  readonly amount: string;
  readonly ref: string;
  readonly status: 'PENDING' | 'REJECTED';
}

export const TEST_ONLY_EVENTS: readonly EventRow[] = [
  // CLM-AT-16: the closed CLM-103 is reopened on 18 Oct.
  { id: 'EVT-CLM-103-3', claim: 'CLM-103', at: '2026-10-18', from: 'Closed', to: 'Reopened', reason: 'Customer disputed the settlement' },
  // CLM-AT-09: an event for CLM-105 with no time.
  { id: 'EVT-CLM-105-2', claim: 'CLM-105', at: null, from: 'New', to: 'Triage', reason: 'Time not recorded' },
  // CLM-AT-10: an earlier event written after the later ones.
  { id: 'EVT-CLM-106-3', claim: 'CLM-106', at: '2026-09-27', from: 'New', to: 'Triage', reason: 'Logged late' },
];

export const TEST_ONLY_PAYMENTS: readonly PaymentRow[] = [
  // CLM-AT-11: payments in the period that are not posted.
  { id: 'CPAY-CLM-104-P', claim: 'CLM-104', paidAt: '2026-10-20', amount: '3000', ref: 'SYN-PAY-CLM-104-PENDING', status: 'PENDING' },
  { id: 'CPAY-CLM-106-R', claim: 'CLM-106', paidAt: '2026-10-19', amount: '2000', ref: 'SYN-PAY-CLM-106-REJECTED', status: 'REJECTED' },
];

// Where the rows go in the bundled CSV: after a fixture row copied exactly from the fixture file.
const EVENTS_ANCHOR = 'TEST,EVT-CLM-106-2,CLM-106,2026-09-30,New,Assessment,Progressed,USR-CLM';
const PAYMENTS_ANCHOR = 'TEST,CPAY-CLM-103,CLM-103,2026-10-13,4000,BWP,SYN-PAY-CLM-103,POSTED';

const eventCsv = (row: EventRow): string =>
  `TEST,${row.id},${row.claim},${row.at ?? ''},${row.from},${row.to},${row.reason},USR-CLM`;
const paymentCsv = (row: PaymentRow): string =>
  `TEST,${row.id},${row.claim},${row.paidAt},${row.amount},BWP,${row.ref},${row.status}`;

// The bundler writes the CSV line breaks as an escape (`\r`, `\n`) or as the raw character, depending on the build.
const LINE_BREAK = /^(?:\\r|\r)?(?:\\n|\n)/;

/** Prototype: rewrite the bundle. Returns the anchors that were found, so a test can assert that every one of them was. */
export async function addTestOnlyRowsToBundle(page: Page): Promise<string[]> {
  const additions = [
    { after: EVENTS_ANCHOR, rows: TEST_ONLY_EVENTS.map(eventCsv) },
    { after: PAYMENTS_ANCHOR, rows: TEST_ONLY_PAYMENTS.map(paymentCsv) },
  ];
  const applied: string[] = [];
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'script') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    let body = await response.text();
    for (const addition of additions) {
      const at = body.indexOf(addition.after);
      if (at === -1) continue;
      const end = at + addition.after.length;
      const lineBreak = LINE_BREAK.exec(body.slice(end))?.[0];
      if (lineBreak === undefined) continue;
      body = body.slice(0, end) + addition.rows.map((row) => `${lineBreak}${row}`).join('') + body.slice(end);
      applied.push(addition.after);
    }
    const headers = Object.fromEntries(
      Object.entries(response.headers()).filter(([name]) => name !== 'content-length' && name !== 'content-encoding'),
    );
    await route.fulfill({ status: response.status(), headers, body });
  });
  return applied;
}

/** Stack: run `work` on the local database as its owner (the application role may not write events), and only there. */
async function withLocalDatabase(work: Parameters<typeof withClient>[1]): Promise<void> {
  const url = databaseUrl();
  if (!isLocalUrl(url)) throw new Error('The test-only rows are written only to the local database.');
  await withClient(url, work);
}

/** Stack: insert the rows into the TEST tenant. The page must reload to read them. */
export async function addTestOnlyRowsToDatabase(): Promise<void> {
  await withLocalDatabase(async (client) => {
    for (const row of TEST_ONLY_EVENTS) {
      await client.query(
        `insert into claim_events (tenant_id, event_id, claim_id, event_at, from_stage, to_stage, reason, actor_id)
         values ('TEST', $1, $2, $3, $4, $5, $6, 'USR-CLM')`,
        [row.id, row.claim, row.at, row.from, row.to, row.reason],
      );
    }
    for (const row of TEST_ONLY_PAYMENTS) {
      await client.query(
        `insert into claim_payments (tenant_id, claim_payment_id, claim_id, paid_at, paid_amount, currency, payment_ref, status)
         values ('TEST', $1, $2, $3, $4, 'BWP', $5, $6)`,
        [row.id, row.claim, row.paidAt, row.amount, row.ref, row.status],
      );
    }
  });
}

/** Stack: take the rows out again, so the other specs meet the shipped TEST data. */
export async function removeTestOnlyRowsFromDatabase(): Promise<void> {
  await withLocalDatabase(async (client) => {
    await client.query(`delete from claim_events where tenant_id = 'TEST' and event_id = any($1)`, [TEST_ONLY_EVENTS.map((row) => row.id)]);
    await client.query(`delete from claim_payments where tenant_id = 'TEST' and claim_payment_id = any($1)`, [TEST_ONLY_PAYMENTS.map((row) => row.id)]);
  });
}
