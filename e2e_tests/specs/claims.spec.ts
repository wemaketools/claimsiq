/**
 * The claim screens in a real browser at 1366px: a Head of Claims signs in, reads the TEST figures on Overview, opens
 * the claims behind a card with the keyboard, narrows by filter, downloads the CSV and compares it to the table, reads
 * Stages & Aging, resets (the toast passes axe), and everything passes axe in both themes.
 *
 * Prerequisites: as in shell.spec.ts. The 3 second budget on 500 claims is measured in the SPA suite
 * (features/overview/performance.test.tsx), because the browser build bundles only the TEST and DEMO fixtures.
 */
import { readFileSync } from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const PASSWORD = 'test1234';

async function expectNoAxeViolations(page: Page): Promise<void> {
  // Axe reads colours, so let any running colour transition (theme switch, active link) finish first.
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map(
      (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('claim screens', () => {
  test('Overview, its click-through, filters, CSV and Stages & Aging work with the keyboard at 1366px and pass axe in both themes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/signin');
    await page.getByLabel('Email address').fill('head.of.claims@claimsiq.local');
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
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
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

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
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
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
    await page.getByRole('link', { name: 'View policy invoices' }).click();
    await expect(page.getByRole('table', { name: 'Invoices of the policy' })).toContainText('INV-001');
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);

    // Reset shows a toast; with it on screen the page still passes axe (a status role on a list item used to fail it).
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByText('The TEST fixture is back as loaded.')).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
