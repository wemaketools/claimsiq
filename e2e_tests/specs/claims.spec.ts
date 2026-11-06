/**
 * The claim screens in a real browser at 1366px: a Head of Claims signs in, reads the TEST figures on Overview, opens
 * the claims behind a card with the keyboard, narrows by filter, downloads the CSV and compares it to the table, reads
 * Stages & Aging, edits the rules (a higher high-value line reaches Overview; Restore defaults and Reset bring the
 * spec's back), reads Exceptions & SLA with the filter kept, opens the flagged claim (Claim Detail, with its reserve
 * flag) and its policy's invoices, resets (the toast passes axe), and everything passes axe in both themes.
 *
 * Every figure comes from the real API and the database: the test records the API calls the page makes and ends by
 * checking the Overview figures were requested from `/api/v1`, with Reset as a command on it.
 *
 * Prerequisites: as in shell.spec.ts. The 3 second budget on 500 claims is measured in the SPA suite
 * (features/overview/performance.test.tsx), because the browser build bundles only the TEST and DEMO fixtures.
 */
import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { expectNoAxeViolations, expectNoHorizontalScroll, resetData } from './support';

test.describe('claim screens', () => {
  test('Overview, its click-through, filters, CSV and Stages & Aging work with the keyboard at 1366px and pass axe in both themes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/v1/')) apiCalls.push(`${request.method()} ${url.pathname}`);
    });
    await page.goto('/signin');
    await page.getByRole('button', { name: /Head of Claims/ }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await page.getByLabel('Data set').selectOption('TEST');

    // CLM-AT-01/02 on screen: 5 open, 1 closed, P9,000 + P68,000 = P77,000.
    const card = (name: string) => page.getByRole('region', { name, exact: true });
    await expect(card('Open claims')).toContainText('5');
    await expect(card('Closed claims')).toContainText('1');
    await expect(card('Paid to date')).toContainText('P9,000.00');
    await expect(card('Outstanding reserve')).toContainText('P68,000.00');
    await expect(card('Incurred')).toContainText('P77,000.00');
    await expect(card('SLA breaches')).toContainText('3');
    await expect(card('High-value claims')).toContainText('1');
    // The period cards: the last 30 days by default, and the period choice in the filter bar moves them.
    await expect(card('New claims')).toContainText('5');
    await expect(card('Paid in period')).toContainText('P9,000.00');
    await expect(card('Average closed turnaround')).toContainText('5.0 days');
    await expect(card('High-priority exceptions')).toContainText('3');
    await page.getByLabel('Period', { exact: true }).selectOption('7d');
    await expect(card('New claims')).toContainText('2');
    await expect(card('Paid in period')).toContainText('P0.00');
    await page.getByLabel('Period', { exact: true }).selectOption('30d');
    // Paid by month: the posted payments of 22 Sep (P5,000) and 13 Oct (P4,000), which add up to Paid to date.
    const paidByMonth = page.getByRole('table', { name: 'Posted paid by month' });
    await expect(paidByMonth.getByRole('row')).toHaveText(['MonthPosted paid (BWP)', 'Sep 2026P5,000.00', 'Oct 2026P4,000.00']);
    await expect(page.getByRole('region', { name: 'Paid by month' })).toContainText('P9,000.00 posted on 2 payments over 2 months.');
    await expect(page.getByRole('region', { name: 'Paid by month' }).locator('.recharts-bar-rectangle').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    // Rules: the Head of Claims raises the high-value line through the API and CLM-106 stops being high value on Overview;
    // Restore defaults brings it back (both are audited). A persona that may not edit sees the rules read-only.
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const highValue = page.getByLabel('High-value line');
    await nav.getByRole('link', { name: 'Rules' }).click();
    await expect(highValue).toHaveValue('25000');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    // The supplier sample minimum is raised in the same save, so Supplier Insights stops placing Mma-Motor against the baseline.
    await nav.getByRole('link', { name: 'Suppliers' }).click();
    const waitPercentiles = page.getByRole('table', { name: 'Wait percentiles by supplier' });
    const mma = waitPercentiles.getByRole('row', { name: /Mma-Motor Repairs/ });
    await expect(mma).toContainText('11Over the target');
    await expect(mma).toContainText('13Over the target');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await nav.getByRole('link', { name: 'Rules' }).click();
    await highValue.fill('40000');
    await page.getByLabel('Supplier sample minimum').fill('3');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('The rules were saved (version 2).')).toBeVisible();
    await nav.getByRole('link', { name: 'Suppliers' }).click();
    await expect(mma).toContainText('Not enough data: 2 of 3 needed');
    await expect(mma).not.toContainText('Over the target');
    await nav.getByRole('link', { name: 'Rules' }).click();
    await expect(page.getByRole('table', { name: 'History of changes to the rules' })).toContainText('Head of Claims');
    await nav.getByRole('link', { name: 'Overview' }).click();
    await expect(card('High-value claims')).toContainText('0');
    await nav.getByRole('link', { name: 'Rules' }).click();
    await page.getByRole('combobox', { name: 'Viewing as' }).selectOption('claims-handler');
    await expect(page.getByText('Read-only for this persona')).toBeVisible();
    await expect(highValue).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Viewing as' }).selectOption('head-of-claims');
    await page.getByRole('button', { name: 'Restore defaults' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restore defaults' }).click();
    await expect(page.getByText('The spec’s rules are back (version 3).')).toBeVisible();
    await nav.getByRole('link', { name: 'Overview' }).click();
    await expect(card('High-value claims')).toContainText('1');

    // A card is a link: the keyboard reaches it and Enter lists exactly the claims it counts.
    await card('High-value claims').getByRole('link').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/claims\?show=high-value$/);
    const claimIds = () => page.getByRole('table', { name: 'Claims' }).locator('tbody tr td:first-child');
    await expect(claimIds()).toHaveText(['CLM-106']);
    await page.getByRole('link', { name: 'Show all claims' }).click();
    await expect(claimIds()).toHaveCount(6);
    await expectNoHorizontalScroll(page);

    // The filter bar narrows the list, and the CSV is that list.
    await page.getByLabel('Broker').selectOption({ label: 'Kopano Brokers (fictional)' });
    await expect(claimIds()).toHaveText(['CLM-101', 'CLM-104']);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('claimsiq-claims-TEST-2026-10-21.csv');
    const lines = readFileSync(await download.path(), 'utf8').trim().split(/\r?\n/);
    expect(lines.slice(1).map((line) => line.split(',')[0])).toEqual(['CLM-101', 'CLM-104']);
    await expectNoAxeViolations(page);

    // Stages & Aging keeps the filter, and both themes pass axe.
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Stages & Aging' }).click();
    await expect(page.getByRole('table', { name: 'Open claims and their value by stage' })).toContainText('Approved');
    await expect(page.getByText('All open claims: 2').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Use dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectNoAxeViolations(page);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Overview' }).click();
    await expect(card('Open claims')).toContainText('2');
    await expectNoAxeViolations(page);

    // Exceptions & SLA keeps the filter; a flagged claim opens with its reserve flag, and its policy opens its invoice.
    await nav.getByRole('link', { name: 'Exceptions & SLA' }).click();
    const exceptionIds = page.getByRole('table', { name: 'Exceptions' }).locator('tbody tr td:first-child');
    await expect(exceptionIds).toHaveText(['CLM-101']);
    await expect(page.getByRole('table', { name: 'Exceptions' })).toContainText('Supplier delay');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await page.getByRole('link', { name: 'CLM-101' }).click();
    await expect(page.getByRole('heading', { name: 'Claim CLM-101', level: 1 })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Reserve history of the claim' })).toContainText('Review: material change');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    // The stage what-if answers from the API's rules engine, shows the move beside the real view, and saves nothing.
    const whatIf = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Stage what-if' }) });
    await expect(whatIf).toContainText('What-if: not saved');
    await whatIf.getByLabel('Move the claim to').selectOption('Negotiation');
    const compared = whatIf.getByRole('table', { name: 'Claim now and in a what-if move to Negotiation' });
    await expect(compared).toContainText('Assessment');
    await expect(compared).toContainText('Negotiation: 0 of 5 business days used');
    await expectNoAxeViolations(page);
    await whatIf.getByRole('button', { name: 'Reset' }).click();
    await expect(compared).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('table', { name: 'Reserve history of the claim' })).toContainText('Review: material change');
    await expect(page.getByRole('list', { name: 'Stage history of CLM-101' })).toContainText('Assessment');
    await expect(page.getByLabel('Move the claim to')).toHaveValue('');
    await page.getByRole('link', { name: 'View policy invoices' }).click();
    await expect(page.getByRole('table', { name: 'Invoices of the policy' })).toContainText('INV-001');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    // A saved rule is a change like a task: Reset puts the spec's rules back and clears their history.
    await nav.getByRole('link', { name: 'Rules' }).click();
    await highValue.fill('40000');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('The rules were saved (version 4).')).toBeVisible();

    // Reset shows a toast; with it on screen the page still passes axe (a status role on a list item used to fail it).
    await resetData(page, 'TEST');
    await expect(highValue).toHaveValue('25000');
    await expect(page.getByText('No changes yet')).toBeVisible();
    await expectNoAxeViolations(page);
    expect(apiCalls).toEqual(expect.arrayContaining(['GET /api/v1/rule-config', 'POST /api/v1/rule-config', 'POST /api/v1/rule-config/restore', 'GET /api/v1/claim-facts', 'GET /api/v1/paid-trend', 'GET /api/v1/supplier-insights', 'GET /api/v1/claims', 'GET /api/v1/claims/CLM-101/what-if', 'POST /api/v1/demo/reset']));
  });
});
