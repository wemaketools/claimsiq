/**
 * Checks every spec runs on a screen: WCAG 2.0/2.1 A and AA through axe, and no horizontal page scroll.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function expectNoAxeViolations(page: Page): Promise<void> {
  // Axe reads colours, so let any running colour transition (theme switch, active link) settle first; a cancelled
  // animation (a closing dialog) counts as settled.
  await page.evaluate(() =>
    Promise.allSettled(document.getAnimations().map((animation) => animation.finished)),
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    ),
  ).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Reset from the top bar, confirmed in its dialog, and the toast that says the data set is back as loaded. */
export async function resetData(page: Page, dataSet: string): Promise<void> {
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByText(`The ${dataSet} fixture is back as loaded.`)).toBeVisible();
}
