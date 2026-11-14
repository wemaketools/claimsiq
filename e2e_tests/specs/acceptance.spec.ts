/**
 * The acceptance scenarios CLM-AT-01 to CLM-AT-16 of the claims requirements (section 11), run in BOTH Playwright
 * projects by this one spec: `prototype` (the hosted-demo build, the in-browser mock API, no Supabase) and `stack` (the
 * Vite dev server over the Hono API and the local Supabase database). The screens, the steps and the figures are the
 * same; every assertion block is a `test.step` named after its scenario, so a failure names the CLM-AT it breaks. Two flows:
 * - the TEST data set as shipped: AT-01 to 08 and AT-12 to 15, walked as a Head of Claims;
 * - the same data set with a few test-only rows (testOnlyRows.ts; `fixtures/v2` is untouched): AT-09 (a missing stage
 *   time), AT-10 (events out of order), AT-11 (pending and rejected payments) and AT-16 (a reopened claim), which the
 *   shipped data has no row for.
 *
 * The modes differ in one place: how the test-only rows reach the data (the bundle is rewritten in the prototype, the
 * rows are inserted into the local database in the stack). Sign-in, Reset and the screens are the same clicks in both.
 *
 * Prerequisites: prototype none beyond the browser; stack as in shell.spec.ts (the local Supabase stack running and the
 * database built). Playwright builds and serves the app (playwright.config.ts). Both flows start with Reset, so a run
 * the stack project left half-done cannot change the figures, and the stack project runs on one worker.
 */
import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

import { resetData } from './support';
import { addTestOnlyRowsToBundle, addTestOnlyRowsToDatabase, removeTestOnlyRowsFromDatabase } from './testOnlyRows';

const inStack = (testInfo: TestInfo): boolean => testInfo.project.name === 'stack';

/** A role click signs in (in the prototype build at once, in the stack through the server's demo sign-in), then the TEST data set, as loaded. */
async function openTestDataSet(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: /^Head of Claims/ }).click();
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
  await page.getByLabel('Data set').selectOption('TEST');
  await resetData(page, 'TEST');
}

const card = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
/** The figure of a card alone, so a check on 5 cannot pass on 25. */
const cardValue = (page: Page, name: string) => card(page, name).locator('.ciq-kpi-value');
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' });
const goTo = (page: Page, screen: string) => nav(page).getByRole('link', { name: screen }).click();
const claimsTable = (page: Page) => page.getByRole('table', { name: 'Claims' });
const claimIds = (page: Page) => claimsTable(page).locator('tbody tr td:first-child');
const claimRow = (page: Page, id: string) => claimsTable(page).getByRole('row').filter({ hasText: id });
const cell = (page: Page, id: string, column: number) => claimRow(page, id).getByRole('cell').nth(column);
const CLAIM_COLUMN = { stage: 3, paid: 6, reserve: 7, incurred: 8, sla: 9 } as const;

/** "P9,000.00" or "9000.00" in cents, so sums never go through a float. */
function cents(text: string): bigint {
  const [whole = '0', fraction = '00'] = text.replace(/[^\d.]/g, '').split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

async function columnTotal(page: Page, column: number): Promise<bigint> {
  const texts = await claimsTable(page).locator(`tbody tr td:nth-child(${column + 1})`).allInnerTexts();
  return texts.reduce((sum, text) => sum + cents(text), 0n);
}

test.describe('acceptance scenarios CLM-AT-01 to CLM-AT-16', () => {
  // The rows of the second flow are not left in the database for the specs that follow (Reset would remove them too).
  test.afterEach(async ({}, testInfo) => {
    if (inStack(testInfo)) await removeTestOnlyRowsFromDatabase();
  });

  test('the TEST data set meets the snapshot, stage, money, rule, filter, task, export and policy-join scenarios', async ({
    page,
  }) => {
    await openTestDataSet(page);

    await test.step('CLM-AT-01 snapshot: at 21 Oct there are 5 open and 1 closed claims', async () => {
      await expect(cardValue(page, 'Open claims')).toHaveText('5');
      await expect(cardValue(page, 'Closed claims')).toHaveText('1');
      await card(page, 'Open claims').getByRole('link').click();
      await expect(claimIds(page)).toHaveText(['CLM-101', 'CLM-102', 'CLM-104', 'CLM-105', 'CLM-106']);
      await goTo(page, 'Overview');
      await card(page, 'Closed claims').getByRole('link').click();
      await expect(claimIds(page)).toHaveText(['CLM-103']);
    });

    await test.step('CLM-AT-02 financial: P9,000 paid + P68,000 open reserve = P77,000 incurred, no duplicate reserve versions', async () => {
      await goTo(page, 'Overview');
      await expect(cardValue(page, 'Paid to date')).toHaveText('P9,000.00');
      await expect(cardValue(page, 'Outstanding reserve')).toHaveText('P68,000.00');
      await expect(cardValue(page, 'Incurred')).toHaveText('P77,000.00');
      await goTo(page, 'Claims');
      await expect(claimIds(page)).toHaveCount(6);
      // The list adds up to the cards, and CLM-101 holds its latest reserve (P11,000), not P8,000 + P11,000.
      expect(await columnTotal(page, CLAIM_COLUMN.paid)).toBe(900000n);
      expect(await columnTotal(page, CLAIM_COLUMN.reserve)).toBe(6800000n);
      expect(await columnTotal(page, CLAIM_COLUMN.incurred)).toBe(7700000n);
      await expect(cell(page, 'CLM-101', CLAIM_COLUMN.reserve)).toHaveText('P11,000.00');
      await expect(cell(page, 'CLM-102', CLAIM_COLUMN.reserve)).toHaveText('P12,000.00');
    });

    await test.step('CLM-AT-03 stages: the open stage counts sum to 5, Closed (1) is shown apart', async () => {
      await goTo(page, 'Stages & Aging');
      const stages = page.getByRole('table', { name: 'Open claims and their value by stage' });
      for (const [stage, count] of [['New', '1'], ['Triage', '1'], ['Assessment', '2'], ['Approved', '1']] as const) {
        await expect(stages.getByRole('row', { name: `Open claims: ${stage}` }).getByRole('cell').nth(1)).toHaveText(count);
      }
      await expect(page.getByText(/^All open claims: 5(?!\d)/).first()).toBeVisible();
      await expect(stages).not.toContainText('Closed');
      await goTo(page, 'Overview');
      await expect(cardValue(page, 'Closed claims')).toHaveText('1');
    });

    await test.step('CLM-AT-04 approved: CLM-104 approved P9,000 outstanding is never counted as paid', async () => {
      await goTo(page, 'Claims');
      await expect(cell(page, 'CLM-104', CLAIM_COLUMN.stage)).toHaveText('Approved');
      await expect(cell(page, 'CLM-104', CLAIM_COLUMN.paid)).toHaveText('P0.00');
      await expect(cell(page, 'CLM-104', CLAIM_COLUMN.reserve)).toHaveText('P9,000.00');
      await claimsTable(page).getByRole('link', { name: 'CLM-104' }).click();
      await expect(page.getByRole('heading', { name: 'Claim CLM-104', level: 1 })).toBeVisible();
      await expect(page.getByText('Approved is not paid')).toBeVisible();
      await expect(
        page.getByText('No posted payment exists yet. The P9,000.00 still held as an outstanding reserve has not been paid.'),
      ).toBeVisible();
    });

    await test.step('CLM-AT-05 closure: CLM-103 is in no open aging figure and no active SLA breach', async () => {
      await goTo(page, 'Overview');
      await expect(cardValue(page, 'SLA breaches')).toHaveText('3');
      await card(page, 'SLA breaches').getByRole('link').click();
      await expect(claimIds(page)).toHaveText(['CLM-101', 'CLM-102', 'CLM-106']);
      await goTo(page, 'Stages & Aging');
      await expect(page.getByText(/^All open claims: 5(?!\d)/).first()).toBeVisible();
      const ages = page.getByRole('table', { name: 'Open claims and their value by age' });
      await expect(ages.getByRole('row', { name: 'Open claims: 0-7 days' }).getByRole('cell').nth(1)).toHaveText('2');
      await goTo(page, 'Exceptions & SLA');
      await expect(page.getByRole('table', { name: 'Exceptions' }).locator('tbody tr td:first-child')).toHaveText([
        'CLM-102',
        'CLM-106',
        'CLM-101',
        'CLM-105',
      ]);
      await page.goto('/claims/CLM-103');
      await expect(page.getByText('The claim is closed, so no service targets or review indicators apply.')).toBeVisible();
      const released = page.getByRole('table', { name: 'Reserve history of the claim' });
      await expect(released).toContainText('Released on closure');
      await expect(released).not.toContainText('Review: material change');
    });

    await test.step('CLM-AT-06 reserve alert: CLM-101 P8,000 to P11,000 is a review cue, not a proven leakage event', async () => {
      await page.goto('/claims/CLM-101');
      const reserve = page.getByRole('table', { name: 'Reserve history of the claim' });
      await expect(reserve.getByRole('row').filter({ hasText: '16 Oct 2026' })).toContainText('+P3,000.00');
      await expect(reserve.getByRole('row').filter({ hasText: '16 Oct 2026' })).toContainText('Review: material change');
      await expect(page.getByText('A material move is a cue to look at the evidence behind it. It is not a finding.')).toBeVisible();
      await expect(page.locator('main')).not.toContainText(/leakage/i);
    });

    await test.step('CLM-AT-07 high value: CLM-106 P30,000 incurred is over the P25,000 line and links to its detail', async () => {
      await goTo(page, 'Overview');
      await expect(cardValue(page, 'High-value claims')).toHaveText('1');
      await card(page, 'High-value claims').getByRole('link').click();
      await expect(claimIds(page)).toHaveText(['CLM-106']);
      await expect(cell(page, 'CLM-106', CLAIM_COLUMN.incurred)).toHaveText('P30,000.00');
      await claimsTable(page).getByRole('link', { name: 'CLM-106' }).click();
      await expect(page.getByRole('heading', { name: 'Claim CLM-106', level: 1 })).toBeVisible();
      await expect(
        page.getByText('Incurred P30,000.00 is at or above the P25,000.00 high-value line and the claim is delayed'),
      ).toBeVisible();
    });

    await test.step('CLM-AT-08 supplier: CLM-106 waits 13 business days from the request time, over the 5-day target', async () => {
      // The wait runs from the request on 2 Oct (13 business days to 21 Oct), not from the stage entry on 30 Sep (15).
      const request = page
        .getByRole('table', { name: 'Supplier requests of the claim' })
        .getByRole('row')
        .filter({ hasText: 'REQ-CLM-106' });
      await expect(request).toContainText('2 Oct 2026');
      await expect(request).toContainText('13 of 5 business days (8 over)');
      await expect(request).toContainText('Delayed');
      await goTo(page, 'Suppliers');
      const supplier = page.getByRole('table', { name: 'Suppliers' }).getByRole('row', { name: /Mma-Motor Repairs/ });
      await expect(supplier.getByRole('cell').nth(3)).toHaveText('13');
      await expect(supplier.getByRole('cell').nth(4)).toHaveText('2');
    });

    await test.step('CLM-AT-12 filters: broker, product and handler update Overview, Stages & Aging, the list and the sums together', async () => {
      await goTo(page, 'Overview');
      await page.getByLabel('Broker').selectOption({ label: 'Kopano Brokers (fictional)' });
      await expect(cardValue(page, 'Open claims')).toHaveText('2');
      await expect(cardValue(page, 'Closed claims')).toHaveText('0');
      await expect(cardValue(page, 'Outstanding reserve')).toHaveText('P20,000.00');
      await expect(cardValue(page, 'Incurred')).toHaveText('P20,000.00');
      await goTo(page, 'Stages & Aging');
      await expect(page.getByText(/^All open claims: 2(?!\d)/).first()).toBeVisible();
      await goTo(page, 'Claims');
      await expect(claimIds(page)).toHaveText(['CLM-101', 'CLM-104']);
      expect(await columnTotal(page, CLAIM_COLUMN.incurred)).toBe(2000000n);
      await page.getByLabel('Product').selectOption({ label: 'Comprehensive Motor' });
      await expect(claimIds(page)).toHaveText(['CLM-101']);
      await goTo(page, 'Overview');
      await expect(cardValue(page, 'Open claims')).toHaveText('1');
      await expect(cardValue(page, 'Incurred')).toHaveText('P11,000.00');
      await page.getByRole('button', { name: 'Clear filters' }).click();
      await page.getByLabel('Handler').selectOption({ label: 'Boitumelo Demo' });
      await expect(cardValue(page, 'Open claims')).toHaveText('5');
      await expect(cardValue(page, 'Incurred')).toHaveText('P77,000.00');
      await goTo(page, 'Stages & Aging');
      await expect(page.getByText(/^All open claims: 5(?!\d)/).first()).toBeVisible();
      await goTo(page, 'Claims');
      await expect(claimIds(page)).toHaveCount(6);
      expect(await columnTotal(page, CLAIM_COLUMN.incurred)).toBe(7700000n);
      await page.getByRole('button', { name: 'Clear filters' }).click();
    });

    await test.step('CLM-AT-13 task: a supplier follow-up on CLM-106 is assigned, and its status update shows in the Action Queue after a refresh', async () => {
      await page.goto('/claims/CLM-106');
      await page.getByRole('button', { name: 'Create follow-up task' }).first().click();
      const create = page.getByRole('dialog', { name: 'Create a follow-up task' });
      await create.getByRole('combobox', { name: 'Assign to' }).selectOption({ label: 'Mpho Demo' });
      await create.getByLabel('Due date').fill('2026-10-23');
      await create
        .getByRole('textbox', { name: /Next action/ })
        .fill('Chase Mma-Motor Repairs for the repair estimate (REQ-CLM-106)');
      await create.getByRole('button', { name: 'Create task' }).click();
      await goTo(page, 'Action Queue');
      const queueRow = page.getByRole('table', { name: 'Action Queue' }).getByRole('row').filter({ hasText: 'CLM-106' });
      await expect(queueRow).toContainText('Mpho Demo');
      await expect(queueRow).toContainText('Open');
      await queueRow.getByRole('button', { name: /^Actions for/ }).click();
      await page.getByRole('menuitem', { name: 'Change status' }).click();
      const change = page.getByRole('dialog', { name: 'Change the status' });
      await change.getByRole('combobox', { name: /^New status/ }).selectOption({ label: 'In progress' });
      await change.getByRole('button', { name: 'Change status' }).click();
      await expect(queueRow).toContainText('In progress');
      await page.reload();
      await expect(
        page.getByRole('table', { name: 'Action Queue' }).getByRole('row').filter({ hasText: 'CLM-106' }),
      ).toContainText('In progress');
    });

    await test.step('CLM-AT-14 export: the CSV equals the filtered list on screen, claim ids, count and amounts', async () => {
      await goTo(page, 'Claims');
      await page.getByLabel('Product').selectOption({ label: 'Property All Risk' });
      await expect(claimIds(page)).toHaveText(['CLM-102', 'CLM-106']);
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export CSV' }).click(),
      ]);
      const [header, ...lines] = readFileSync(await download.path(), 'utf8').trim().split(/\r?\n/);
      expect(header).toContain('Claim');
      const fields = lines.map((line) => line.split(','));
      expect(fields.map((row) => row[0])).toEqual(await claimIds(page).allInnerTexts());
      for (const row of fields) {
        const id = row[0] ?? '';
        for (const column of [CLAIM_COLUMN.paid, CLAIM_COLUMN.reserve, CLAIM_COLUMN.incurred]) {
          expect(cents(row[column] ?? '')).toBe(cents(await cell(page, id, column).innerText()));
        }
      }
      const csvIncurred = fields.reduce((sum, row) => sum + cents(row[CLAIM_COLUMN.incurred] ?? ''), 0n);
      expect(csvIncurred).toBe(await columnTotal(page, CLAIM_COLUMN.incurred));
      expect(csvIncurred).toBe(4700000n);
      await page.getByRole('button', { name: 'Clear filters' }).click();
    });

    await test.step('CLM-AT-15 module join: CLM-106 to its policy, then to the invoices carrying that policy id and no others', async () => {
      await page.goto('/claims/CLM-106');
      await expect(page.getByText('SYN-BW-00006 POL-006')).toBeVisible();
      await page.getByRole('link', { name: 'View policy invoices' }).click();
      await expect(page).toHaveURL(/\/policies\/POL-006\/invoices\?claim=CLM-106$/);
      await expect(page.getByRole('heading', { name: 'Policy invoices', level: 1 })).toBeVisible();
      await expect(page.getByText('joins on the policy identifier only, never on a name')).toBeVisible();
      const invoices = page.getByRole('table', { name: 'Invoices of the policy' });
      await expect(invoices.locator('tbody tr')).toHaveCount(1);
      await expect(invoices).toContainText('INV-006');
      await expect(invoices).toContainText('P7,000.00');
    });

    await test.step('demo reset: the TEST fixture is back as loaded, without the task', async () => {
      await resetData(page, 'TEST');
      await goTo(page, 'Action Queue');
      await expect(page.getByText('No actions in the queue')).toBeVisible();
    });
  });

  test('the TEST data set with test-only rows shows a missing stage time as unknown, orders events by time, keeps unposted payments out of paid and reopens a closed claim', async ({
    page,
  }, testInfo) => {
    if (inStack(testInfo)) {
      await openTestDataSet(page);
      await addTestOnlyRowsToDatabase();
      await page.reload();
    } else {
      const applied = await addTestOnlyRowsToBundle(page);
      await openTestDataSet(page);
      expect(applied).toHaveLength(2);
    }

    await test.step('CLM-AT-09 missing timestamps: a claim with an event of no time shows SLA unknown, never within target', async () => {
      await goTo(page, 'Claims');
      await expect(cell(page, 'CLM-105', CLAIM_COLUMN.sla)).toHaveText('Unknown');
      await page.goto('/claims/CLM-105');
      await expect(page.getByText('SLA unknown').first()).toBeVisible();
      await expect(page.getByText('No time recorded: this event cannot be placed in order.')).toBeVisible();
      await expect(page.getByText('Within target', { exact: true })).toHaveCount(0);
      await goTo(page, 'Exceptions & SLA');
      await expect(page.getByRole('table', { name: 'Exceptions' }).getByRole('row').filter({ hasText: 'CLM-105' })).toContainText(
        'SLA unknown',
      );
    });

    await test.step('CLM-AT-10 event order: events show oldest first whatever their order in the file, and the latest defines the stage', async () => {
      await page.goto('/claims/CLM-106');
      const history = page.getByRole('list', { name: 'Stage history of CLM-106' }).getByRole('listitem');
      await expect(history).toHaveCount(3);
      await expect(history.nth(0)).toContainText('Entered New');
      await expect(history.nth(1)).toContainText('27 Sep 2026');
      await expect(history.nth(2)).toContainText('30 Sep 2026');
      await expect(history.nth(2)).toContainText('Current stage');
      await expect(page.getByText('The recorded stage Assessment matches the event history.')).toBeVisible();
      // Where the latest event and the recorded stage disagree, the page says so (CLM-103, reopened below).
      await page.goto('/claims/CLM-103');
      await expect(page.getByText('The recorded stage Closed differs from the event history (Reopened).')).toBeVisible();
    });

    await test.step('CLM-AT-11 payments: pending and rejected payments add nothing to paid in the period or paid to date', async () => {
      await goTo(page, 'Overview');
      await expect(cardValue(page, 'Paid to date')).toHaveText('P9,000.00');
      await expect(cardValue(page, 'Paid in period')).toHaveText('P9,000.00');
      await page.goto('/claims/CLM-104');
      await expect(page.getByText('P3,000.00').first()).toBeVisible();
      const unposted = page.getByRole('table', { name: 'Payments that are not posted' });
      await expect(unposted).toContainText('SYN-PAY-CLM-104-PENDING');
      await expect(unposted).toContainText('Pending');
      await expect(page.getByText('Posted total: P0.00')).toBeVisible();
      await page.goto('/claims/CLM-106');
      await expect(page.getByRole('table', { name: 'Payments that are not posted' })).toContainText('Rejected');
      await expect(page.getByText('Posted total: P0.00')).toBeVisible();
    });

    await test.step('CLM-AT-16 reopen: reopening CLM-103 adds to its history and moves it back to open', async () => {
      await goTo(page, 'Overview');
      await expect(cardValue(page, 'Open claims')).toHaveText('6');
      await expect(cardValue(page, 'Closed claims')).toHaveText('0');
      await page.goto('/claims/CLM-103');
      const history = page.getByRole('list', { name: 'Stage history of CLM-103' }).getByRole('listitem');
      await expect(history).toHaveCount(3);
      await expect(history.nth(2)).toContainText('Closed → Reopened');
      await expect(history.nth(2)).toContainText('18 Oct 2026');
      await expect(history.nth(2)).toContainText('Current stage');
      await goTo(page, 'Stages & Aging');
      const reopened = page
        .getByRole('table', { name: 'Open claims and their value by stage' })
        .getByRole('row', { name: 'Open claims: Reopened' });
      await expect(reopened.getByRole('cell').nth(1)).toHaveText('1');
    });
  });
});
