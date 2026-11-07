/**
 * The static demo (a production build in prototype mode served by `vite preview`, no Supabase stack): a deep link
 * meets the sign-in page with the roles card and the banner, a role click signs in and returns to the link, every
 * screen works on the in-browser mock API, the session survives a reload, the persona and theme switch, sign-out
 * returns to sign-in, nothing leaves the page's own origin, and every screen passes axe in both themes.
 *
 * Prerequisites: none beyond the browser. Playwright builds and serves the app (playwright.config.ts).
 */
import { expect, test } from '@playwright/test';

import { expectNoAxeViolations, expectNoHorizontalScroll } from './support';

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

test.describe('prototype build', () => {
  test('a role click signs in with no password, every screen works, the session survives a reload, and nothing leaves the origin', async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
    });
    page.on('request', (request) => {
      if (!request.url().startsWith(`${baseURL}/`)) problems.push(`outside request: ${request.url()}`);
    });

    // A deep link while signed out: sign-in with the banner, the explanation and the roles, but no password form.
    await page.goto('/claims/DCLM-002');
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();
    await expect(page.getByRole('note')).toHaveText('Prototype: synthetic demo data');
    await expect(page.getByLabel('Password')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Forgot/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Demo accounts', level: 2 })).toBeVisible();
    await expect(page.getByRole('button')).toHaveText([
      'Head of ClaimsMpho Demo',
      'Claims HandlerBoitumelo Demo',
      'Supplier CoordinatorKagiso Demo',
      'FinanceTiro Demo',
    ]);
    await expectNoAxeViolations(page);
    await expectNoHorizontalScroll(page);

    // The role signs in at once and returns to the link that was asked for.
    await page.getByRole('button', { name: /^Claims Handler/ }).click();
    await expect(page).toHaveURL(/\/claims\/DCLM-002$/);
    await expect(page.getByRole('heading', { name: 'Claim DCLM-002', level: 1 })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Viewing as' })).toHaveValue('claims-handler');
    await expect(page.getByRole('note')).toHaveText('Prototype: synthetic demo data');
    await expectNoAxeViolations(page);

    // Every screen loads its figures from the in-browser mock API.
    const sidebar = page.getByRole('complementary', { name: 'Main navigation and account' });
    const nav = sidebar.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link')).toHaveText(DESTINATIONS);
    for (const name of DESTINATIONS) {
      await nav.getByRole('link', { name }).click();
      await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
      await expect(page.getByRole('region', { name: FILTERS(name) })).toBeVisible();
      await expect(page.getByRole('note')).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
    await nav.getByRole('link', { name: 'Overview' }).click();
    await expect(page.getByRole('region', { name: 'Open claims', exact: true })).toContainText(/\d/);
    await nav.getByRole('link', { name: 'Claims' }).click();
    await expect(page.getByRole('table', { name: 'Claims' }).locator('tbody tr').first()).toBeVisible();
    await page.getByRole('table', { name: 'Claims' }).getByRole('link', { name: 'DCLM-002' }).click();
    await page.getByRole('link', { name: 'View policy invoices' }).click();
    await expect(page.getByRole('heading', { name: 'Policy invoices', level: 1 })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Invoices of the policy' })).toBeVisible();

    // A reload keeps the session (a deep link opens directly: the SPA fallback), persona and theme; the banner stays.
    await page.getByRole('combobox', { name: 'Viewing as' }).selectOption('finance');
    await nav.getByRole('link', { name: 'Overview' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Viewing as' })).toHaveValue('finance');
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Use dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('note')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.goto('/exceptions');
    await expect(page.getByRole('heading', { name: 'Exceptions & SLA', level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);

    // Sign out returns to sign-in, and a reload stays there.
    await page.getByRole('button', { name: /^Boitumelo Demo/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/signin$/);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);

    expect(problems).toEqual([]);
  });
});
