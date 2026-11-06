/**
 * The static demo (a production build in prototype mode served by `vite preview`, no Supabase stack): a deep link
 * meets the sign-in page with the roles card and the banner, a role click signs in and returns to the link, every
 * screen works on the in-browser mock API, the session survives a reload, the persona and theme switch, sign-out
 * returns to sign-in, the rules are edited, restored and reset, nothing leaves the page's own origin, and every screen passes axe in both themes.
 *
 * Prerequisites: none beyond the browser. Playwright builds and serves the app (playwright.config.ts).
 */
import { expect, test } from '@playwright/test';

import {
  DESTINATIONS,
  FILTERS,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  resetData,
} from './support';

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

    // The stage what-if runs in the browser too: DCLM-002 moved to Closed has no stage clock, and nothing is kept.
    const whatIf = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Stage what-if' }) });
    await expect(whatIf).toContainText('What-if: not saved');
    await whatIf.getByLabel('Move the claim to').selectOption('Closed');
    await expect(whatIf.getByRole('table', { name: 'Claim now and in a what-if move to Closed' })).toContainText('No stage clock: the claim is closed.');
    await expectNoAxeViolations(page);
    await page.reload();
    await expect(whatIf.getByLabel('Move the claim to')).toHaveValue('');

    // Every screen loads its figures from the in-browser mock API.
    const sidebar = page.getByRole('complementary', { name: 'Main navigation and account' });
    const nav = sidebar.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link')).toHaveText(DESTINATIONS);
    for (const name of DESTINATIONS) {
      await nav.getByRole('link', { name }).click();
      await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
      const filters = FILTERS(name);
      if (filters !== null) await expect(page.getByRole('region', { name: filters })).toBeVisible();
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

    // Rules: Finance saves a higher high-value line and CLM-106 stops being high value on Overview (the change is kept
    // across a reload), Claims Handler only reads the rules, and Restore defaults and Reset bring the spec's numbers back.
    const card = (name: string) => page.getByRole('region', { name, exact: true });
    const highValue = page.getByLabel('High-value line');
    const saveRules = async (line: string) => {
      await highValue.fill(line);
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    };
    await page.getByLabel('Data set').selectOption('TEST');
    await nav.getByRole('link', { name: 'Overview' }).click();
    await expect(card('High-value claims')).toContainText('1');
    await nav.getByRole('link', { name: 'Rules' }).click();
    await expect(highValue).toHaveValue('25000');
    await expect(page.getByText('Saved P25,000.00 · spec default P25,000.00')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
    await saveRules('40000');
    await expect(page.getByText('The rules were saved (version 2).')).toBeVisible();
    await page.reload();
    await expect(highValue).toHaveValue('40000');
    await expect(page.getByRole('table', { name: 'History of changes to the rules' })).toContainText('Finance');
    await nav.getByRole('link', { name: 'Overview' }).click();
    await expect(card('High-value claims')).toContainText('0');
    await nav.getByRole('link', { name: 'Rules' }).click();
    await page.getByRole('combobox', { name: 'Viewing as' }).selectOption('claims-handler');
    await expect(page.getByText('Read-only for this persona')).toBeVisible();
    await expect(highValue).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await expectNoAxeViolations(page);
    await page.getByRole('combobox', { name: 'Viewing as' }).selectOption('finance');
    await page.getByRole('button', { name: 'Restore defaults' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restore defaults' }).click();
    await expect(page.getByText('The spec’s rules are back (version 3).')).toBeVisible();
    await expect(highValue).toHaveValue('25000');
    await nav.getByRole('link', { name: 'Overview' }).click();
    await expect(card('High-value claims')).toContainText('1');
    await nav.getByRole('link', { name: 'Rules' }).click();
    await saveRules('40000');
    await expect(page.getByText('The rules were saved (version 4).')).toBeVisible();
    await resetData(page, 'TEST');
    await expect(highValue).toHaveValue('25000');
    await expect(page.getByText('No changes yet')).toBeVisible();
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
