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

describe('components.css layout contracts', () => {
  it('contains visually hidden content inside positioned scroll containers so it cannot widen the page', () => {
    for (const selector of ['.ciq-table-wrap', '.ciq-chart', '.ciq-stepper']) {
      expect(rule(selector)).toMatch(/position: relative/);
    }
    expect(rule('.ciq-step')).toMatch(/position: relative/);
  });

  it('spaces the children of a tab panel with the standard page gap', () => {
    const body = rule('.ciq-tabpanel');
    expect(body).toMatch(/display: flex/);
    expect(body).toMatch(/flex-direction: column/);
    expect(body).toMatch(/gap: var\(--ciq-space-4\)/);
  });

  it('drops the own top margin of a spaced stack directly inside a tab panel, so the gap is not doubled', () => {
    expect(rule('.ciq-tabpanel > .ciq-stack--spaced')).toMatch(/margin-top: 0/);
  });

  it('resets list styling on stacks rendered as lists', () => {
    const body = rule('ul.ciq-stack, ol.ciq-stack');
    expect(body).toMatch(/list-style: none/);
    expect(body).toMatch(/padding: 0/);
    expect(body).toMatch(/margin: 0/);
  });

  it('keeps the top bar actions at their size so the title truncates instead', () => {
    expect(rule('.ciq-topbar-actions')).toMatch(/flex: none/);
  });

  it('widens the bar list label column so stage names fit', () => {
    expect(rule('.ciq-barlist-row')).toMatch(/minmax\(96px, 200px\)/);
  });
});

describe('components.css accessibility contracts', () => {
  it('hides the closed navigation drawer from focus and assistive technology', () => {
    const closed = rule('.ciq-sidebar');
    expect(closed).toMatch(/visibility: hidden/);
    expect(rule('.ciq-app--drawer-open .ciq-sidebar')).toMatch(/visibility: visible/);
  });

  it('keeps the focus ring on the selected tab and the skip link', () => {
    expect(
      rule(".ciq-tab--active:focus-visible, .ciq-tab[aria-selected='true']:focus-visible"),
    ).toMatch(/var\(--ciq-focus-ring\), var\(--ciq-shadow-card\)/);
    expect(rule('.ciq-skip-link:focus-visible')).toMatch(/var\(--ciq-focus-ring\)/);
  });

  it('underlines links in running text and gives banner links the banner text colour', () => {
    expect(
      rule(
        ':where(p, dd, figcaption, .ciq-banner, .ciq-text-muted, .ciq-field-hint, .ciq-cell-sub) a:not([class])',
      ),
    ).toMatch(/text-decoration: underline/);
    expect(rule('.ciq-banner a:not([class])')).toMatch(/color: inherit/);
  });
});
