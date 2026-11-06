/**
 * Layout and accessibility contracts of the component class library that jsdom cannot measure (no layout engine):
 * the rules are asserted on the stylesheet itself.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { readSourceFile } from '../test/readSourceFile';

/** The stylesheet without comments, whitespace-normalised once for all `rule()` lookups. */
let normalised = '';

beforeAll(async () => {
  const css = await readSourceFile('./components.css', import.meta.url);
  normalised = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
});

/**
 * The declarations of every rule (media queries included) whose selector list is exactly `selector`
 * (whitespace-normalised), joined.
 */
function rule(selector: string): string {
  const wanted = selector.replace(/\s+/g, ' ').trim();
  const bodies: string[] = [];
  for (const match of normalised.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selectors = '', body = ''] = match;
    if (selectors.trim() === wanted) {
      bodies.push(body);
    }
  }
  if (bodies.length === 0) {
    throw new Error(`No rule for ${selector}`);
  }
  return bodies.join(' ');
}

describe('components.css', () => {
  it('keeps the closed drawer out of focus, the focus ring on the selected tab and skip link, links underlined in text, and scroll containers positioned', () => {
    expect(rule('.ciq-sidebar')).toMatch(/visibility: hidden/);
    expect(rule('.ciq-app--drawer-open .ciq-sidebar')).toMatch(/visibility: visible/);

    expect(
      rule(".ciq-tab--active:focus-visible, .ciq-tab[aria-selected='true']:focus-visible"),
    ).toMatch(/var\(--ciq-focus-ring\), var\(--ciq-shadow-card\)/);
    expect(rule('.ciq-skip-link:focus-visible')).toMatch(/var\(--ciq-focus-ring\)/);

    expect(
      rule(
        ':where(p, dd, figcaption, .ciq-banner, .ciq-text-muted, .ciq-field-hint, .ciq-cell-sub) a:not([class])',
      ),
    ).toMatch(/text-decoration: underline/);
    expect(rule('.ciq-banner a:not([class])')).toMatch(/color: inherit/);

    for (const selector of ['.ciq-table-wrap', '.ciq-chart', '.ciq-stepper', '.ciq-step']) {
      expect(rule(selector)).toMatch(/position: relative/);
    }
  });
});
