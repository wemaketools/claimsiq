/**
 * Test-only rows added to the TEST fixture inside the browser. `fixtures/v1` is never edited: the SPA bundles the CSV
 * text, so the page's script response is rewritten on its way in. A row whose anchor is not found fails the test.
 */
import type { Page } from '@playwright/test';

export interface TestOnlyRows {
  /** An existing row, copied exactly from the fixture file; the new rows follow it. */
  readonly after: string;
  readonly rows: readonly string[];
}

// The bundler writes the CSV line breaks as an escape (`\r`, `\n`) or as the raw character, depending on the build.
const LINE_BREAK = /^(?:\\r|\r)?(?:\\n|\n)/;

/** Returns the anchors that were found, so a test can assert that every one of them was. */
export async function addTestOnlyRows(page: Page, additions: readonly TestOnlyRows[]): Promise<string[]> {
  const applied: string[] = [];
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'script') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    let body = await response.text();
    for (const addition of additions) {
      const at = body.indexOf(addition.after);
      if (at === -1) continue;
      const end = at + addition.after.length;
      const lineBreak = LINE_BREAK.exec(body.slice(end))?.[0];
      if (lineBreak === undefined) continue;
      body = body.slice(0, end) + addition.rows.map((row) => `${lineBreak}${row}`).join('') + body.slice(end);
      applied.push(addition.after);
    }
    const headers = Object.fromEntries(
      Object.entries(response.headers()).filter(([name]) => name !== 'content-length' && name !== 'content-encoding'),
    );
    await route.fulfill({ status: response.status(), headers, body });
  });
  return applied;
}
