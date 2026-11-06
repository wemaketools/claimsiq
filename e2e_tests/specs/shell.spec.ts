/**
 * Shell journeys: real sign-in against local Supabase Auth, the six destinations (the claim screens show the shared
 * filter bar, the rest their empty state), the persona switch and the theme toggle (both survive a reload), sign-out,
 * and axe accessibility checks.
 *
 * Prerequisites: the local Supabase stack is running and the demo accounts exist (`bun run auth:personas`).
 * Playwright starts Vite on its own port (playwright.config.ts).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const PASSWORD = 'test1234';
const DESTINATIONS = [
  'Overview',
  'Stages & Aging',
  'Exceptions & SLA',
  'Claims',
  'Suppliers',
  'Action Queue',
];

/** The destinations whose screens come in later items and still show their empty state. */
const PLACEHOLDERS = ['Suppliers', 'Action Queue'];

async function signIn(page: Page, localPart: string): Promise<void> {
  await page.goto('/signin');
  await page.getByLabel('Email address').fill(`${localPart}@claimsiq.local`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
  expect(summary).toEqual([]);
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
    await signIn(page, 'finance');
    await expect(page).toHaveURL(/\/overview$/);
    const sidebar = page.getByRole('complementary', { name: 'Main navigation and account' });
    await expect(sidebar.locator('.ciq-brand-name')).toHaveText('ClaimsIQ');
    await expect(sidebar.getByText('Claims Intelligence')).toBeVisible();
    const nav = sidebar.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link')).toHaveText(DESTINATIONS);
    for (const name of DESTINATIONS) {
      await nav.getByRole('link', { name }).click();
      await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
      if (PLACEHOLDERS.includes(name)) {
        await expect(page.locator('[data-state="empty"]')).toBeVisible();
      } else {
        await expect(page.getByRole('region', { name: 'Claim filters' })).toBeVisible();
      }
    }
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

    await page.getByRole('button', { name: /^Finance/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/signin$/);
  });
});
