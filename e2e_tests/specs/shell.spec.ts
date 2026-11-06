/**
 * Shell journeys: real sign-in against local Supabase Auth, the six destinations (the claim screens show the shared
 * filter bar, the Action Queue its task filters), a supplier's figures, a task created, assigned and moved on in the Action
 * Queue and kept across a reload (in the database, through the real API), the persona switch and the theme toggle (both survive a reload), sign-out,
 * and axe accessibility checks.
 *
 * Prerequisites: the local Supabase stack is running and the database is built (`bun run db:reset`).
 * Playwright starts the API and Vite on their own ports (playwright.config.ts). The walk changes DEMO data, so it starts
 * and ends with Reset, which is also the proof that Reset restores the fixture.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { expectNoAxeViolations, expectNoHorizontalScroll, resetData } from './support';

const PASSWORD = 'test1234';
const DESTINATIONS = [
  'Overview',
  'Stages & Aging',
  'Exceptions & SLA',
  'Claims',
  'Suppliers',
  'Action Queue',
];

/** Every screen has a filter bar; the Action Queue's is its own. */
const FILTERS = (name: string): string => (name === 'Action Queue' ? 'Task filters' : 'Claim filters');

async function signIn(page: Page, localPart: string): Promise<void> {
  await page.goto('/signin');
  await page.getByLabel('Email address').fill(`${localPart}@claimsiq.local`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test.describe('shell', () => {
  test('the sign-in page passes axe, a wrong password gets one generic message, and a signed-out visitor is sent to sign-in', async ({
    page,
  }) => {
    await page.goto('/claims');
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Demo accounts (local development only)' }),
    ).toBeVisible();
    await expectNoAxeViolations(page);

    await page.getByLabel('Email address').fill('head.of.claims@claimsiq.local');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByRole('alert')).toContainText(
      'We could not sign you in with those details',
    );
    await expect(page).toHaveURL(/\/signin$/);
  });

  test('a demo account signs in to Overview, walks the six destinations, keeps persona and theme across a reload, and signs out', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await signIn(page, 'finance');
    await expect(page).toHaveURL(/\/overview$/);
    await resetData(page, 'DEMO');
    const sidebar = page.getByRole('complementary', { name: 'Main navigation and account' });
    await expect(sidebar.locator('.ciq-brand-name')).toHaveText('ClaimsIQ');
    await expect(sidebar.getByText('Claims Intelligence')).toBeVisible();
    const nav = sidebar.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link')).toHaveText(DESTINATIONS);
    for (const name of DESTINATIONS) {
      await nav.getByRole('link', { name }).click();
      await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
      await expect(page.getByRole('region', { name: FILTERS(name) })).toBeVisible();
    }
    await expectNoAxeViolations(page);

    // Supplier Insights: DEMO holds two requests with Kweneng Assessors, both sent on 1 Oct and still open on 21 Oct, which
    // is 14 business days each against the 5-day target.
    await nav.getByRole('link', { name: 'Suppliers' }).click();
    const kweneng = page.getByRole('table', { name: 'Suppliers' }).getByRole('row', {
      name: /Kweneng Assessors/,
    });
    await expect(kweneng.getByRole('cell').nth(2)).toContainText('14.0');
    await expect(kweneng.getByRole('cell').nth(2)).toContainText('2 requests');
    await expect(kweneng.getByRole('cell').nth(4)).toHaveText('2');
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);
    await kweneng.getByRole('link', { name: /View the cases behind Kweneng/ }).click();
    await expect(page.getByRole('heading', { name: 'Claims', level: 1 })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Claims' }).getByRole('link', { name: 'DCLM-016' })).toBeVisible();

    // Action Queue: a task is created for a claim, assigned and moved on; the change is logged; it survives a reload.
    await nav.getByRole('link', { name: 'Action Queue' }).click();
    await page.getByRole('button', { name: 'Create task' }).click();
    const create = page.getByRole('dialog', { name: 'Create a follow-up task' });
    await create.getByRole('combobox', { name: /^Claim/ }).selectOption('DCLM-016');
    await create.getByRole('combobox', { name: 'Assign to' }).selectOption({ label: 'Mpho Demo' });
    await create.getByLabel('Due date').fill('2026-10-19');
    await create.getByRole('textbox', { name: /Next action/ }).fill('Chase the assessment report');
    await expectNoAxeViolations(page);
    await create.getByRole('button', { name: 'Create task' }).click();
    const queueRow = page
      .getByRole('table', { name: 'Action Queue' })
      .getByRole('row')
      .filter({ hasText: 'DCLM-016' });
    await expect(queueRow).toContainText('Overdue');
    await queueRow.getByRole('button', { name: /^Actions for/ }).click();
    await page.getByRole('menuitem', { name: 'Change status' }).click();
    const change = page.getByRole('dialog', { name: 'Change the status' });
    await change.getByRole('combobox', { name: /^New status/ }).selectOption({ label: 'In progress' });
    await change.getByRole('button', { name: 'Change status' }).click();
    await expect(queueRow).toContainText('In progress');
    await queueRow.getByRole('button', { name: /^History of/ }).click();
    const history = page.getByRole('dialog', { name: /^Task TASK-/ });
    await expect(history.getByRole('listitem').filter({ hasText: 'Created as Open' })).toContainText('Head of Claims');
    await expect(history.getByText('Status changed from Open to In progress')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
    await expectNoHorizontalScroll(page);
    await page.reload();
    await expect(
      page
        .getByRole('table', { name: 'Action Queue' })
        .getByRole('row')
        .filter({ hasText: 'DCLM-016' }),
    ).toContainText('In progress');
    await expectNoAxeViolations(page);

    // A claim opens from the list, and its policy opens the invoices of that policy.
    await nav.getByRole('link', { name: 'Claims' }).click();
    await page.getByRole('table', { name: 'Claims' }).getByRole('link', { name: 'DCLM-002' }).click();
    await expect(page.getByRole('heading', { name: 'Claim DCLM-002', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Stage timeline' })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole('link', { name: 'View policy invoices' }).click();
    await expect(page.getByRole('heading', { name: 'Policy invoices', level: 1 })).toBeVisible();
    await expect(page.getByText('A stand-in for Premium Collections')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Invoices of the policy' })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.getByRole('combobox', { name: 'Viewing as' }).selectOption('supplier-coordinator');
    await page.getByRole('button', { name: 'Use dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Viewing as' })).toHaveValue(
      'supplier-coordinator',
    );
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectNoAxeViolations(page);

    await nav.getByRole('link', { name: 'Action Queue' }).click();
    const queueRows = page.getByRole('table', { name: 'Action Queue' }).getByRole('row').filter({ hasText: 'DCLM-016' });
    await expect(queueRows).toHaveCount(1);
    await resetData(page, 'DEMO');
    await expect(queueRows).toHaveCount(0);

    await page.getByRole('button', { name: /^Finance/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/signin$/);
  });
});
