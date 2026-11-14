/**
 * What the specs share: the checks every screen gets (WCAG 2.0/2.1 A and AA through axe, no horizontal page scroll), the
 * Reset step, the Digest's one-A4-page check, and the sidebar's destinations.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function expectNoAxeViolations(page: Page): Promise<void> {
  // Axe reads colours, so let any running colour transition (theme switch, active link) settle first; a cancelled
  // animation (a closing dialog) counts as settled.
  // Two frames first: a transition only exists once the browser has restyled after the change, which a fast route change
  // (every answer already cached) can leave for the next frame.
  await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
  });
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

/**
 * Make `dataSet` the data set in view. The stack's top bar has a Data set select; a prototype build has none (it serves DEMO),
 * so there the data set is the key that only a test writes, picked up by a reload.
 */
export async function selectDataSet(page: Page, dataSet: 'TEST' | 'DEMO'): Promise<void> {
  if (test.info().project.name === 'prototype') {
    await page.evaluate((value) => localStorage.setItem('ciq.prototype.dataSet', value), dataSet);
    await page.reload();
  } else {
    await page.getByLabel('Data set').selectOption(dataSet);
  }
}

/** Reset from the top bar, confirmed in its dialog, and the toast that says the data set is back as loaded. */
export async function resetData(page: Page, dataSet: string): Promise<void> {
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByText(`The ${dataSet} fixture is back as loaded.`)).toBeVisible();
}

/**
 * The Digest as the browser prints it: whatever the screen theme, the sheet is light, the shell is gone, the as-of date and
 * data set stay, and the A4 PDF has one page.
 */
export async function expectOneLightA4Page(page: Page): Promise<void> {
  await page.emulateMedia({ media: 'print' });
  try {
    const sheet = page.getByRole('article', { name: 'Claims digest' });
    await expect(sheet).toContainText('As of');
    await expect(sheet).toContainText('Data set');
    await expect(page.getByRole('complementary', { name: 'Main navigation and account' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeHidden();
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe('rgb(255, 255, 255)');
    const pdf = await page.pdf({ format: 'A4' });
    expect(pdfPages(pdf)).toBe(1);
  } finally {
    await page.emulateMedia({ media: null });
  }
}

/** The page objects of a PDF; Chromium writes them as plain dictionaries, not inside compressed object streams. */
function pdfPages(pdf: Buffer): number {
  return pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-z])/g)?.length ?? 0;
}

/** The sidebar's destinations, in order. */
export const DESTINATIONS = [
  'Overview',
  'Stages & Aging',
  'Exceptions & SLA',
  'Claims',
  'Suppliers',
  'Action Queue',
  'Digest',
  'Rules',
];

/** The name of the filter bar a destination shows, or null: every screen but Rules has one, and the Action Queue's is its own. */
export const FILTERS = (name: string): string | null => {
  if (name === 'Rules') return null;
  return name === 'Action Queue' ? 'Task filters' : 'Claim filters';
};
