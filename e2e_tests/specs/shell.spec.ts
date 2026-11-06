/**
 * Shell journeys: real sign-in against local Supabase Auth, the six destinations, the persona switch and the theme
 * toggle (both survive a reload), sign-out, and axe accessibility checks.
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
  test('the sign-in page lists the demo accounts in development and passes axe', async ({
    page,
  }) => {
    await page.goto('/signin');
    await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Demo accounts (local development only)' }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('a wrong password shows one generic message', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel('Email address').fill('head.of.claims@claimsiq.local');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(
      'We could not sign you in with those details',
    );
    await expect(page).toHaveURL(/\/signin$/);
  });

  test('a demo account signs in to Overview with the six destinations, and signs out', async ({
    page,
  }) => {
    await signIn(page, 'head.of.claims');
    await expect(page).toHaveURL(/\/overview$/);
    const sidebar = page.getByRole('complementary', { name: 'Main navigation and account' });
    await expect(sidebar.locator('.ciq-brand-name')).toHaveText('ClaimsIQ');
    await expect(sidebar.getByText('Claims Intelligence')).toBeVisible();
    const links = sidebar.getByRole('navigation', { name: 'Main navigation' }).getByRole('link');
    await expect(links).toHaveText(DESTINATIONS);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: /Account menu for Head of Claims/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/signin$/);
  });

  test('every destination renders its title and an empty state', async ({ page }) => {
    await signIn(page, 'head.of.claims');
    for (const name of DESTINATIONS) {
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name }).click();
      await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
      await expect(page.locator('[data-state="empty"]')).toBeVisible();
    }
  });

  test('the persona switch and the theme survive a reload', async ({ page }) => {
    await signIn(page, 'finance');
    const persona = page.getByRole('combobox', { name: 'Viewing as' });
    await persona.selectOption('supplier-coordinator');
    await page.getByRole('button', { name: 'Use dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();

    await expect(page.getByRole('combobox', { name: 'Viewing as' })).toHaveValue(
      'supplier-coordinator',
    );
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectNoAxeViolations(page);
  });

  test('a signed-out visitor to a page is sent to sign-in', async ({ page }) => {
    await page.goto('/claims');
    await expect(page).toHaveURL(/\/signin$/);
  });
});
