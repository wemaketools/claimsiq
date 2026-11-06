import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { generateClaimsFixture } from '../../../../read-model/test-support/generatedFixture';
import { fixtureFiles, transportOver } from '../../test/datasets';
import { renderApp } from '../../test/renderApp';

/** The issue's budget: the dashboard renders within 3 seconds on a generated 500-claim set. */
const BUDGET_MS = 3000;

describe('Overview speed', () => {
  it('renders every card and chart for a generated set of 500 claims within 3 seconds', async () => {
    const transport = transportOver({ DEMO: generateClaimsFixture(fixtureFiles('demo'), 500) });

    const started = performance.now();
    renderApp('/overview', { dataSet: 'DEMO', transport });
    const claims = await screen.findByRole(
      'region',
      { name: 'Open claims' },
      { timeout: BUDGET_MS },
    );
    await screen.findByRole('figure', { name: 'Open claims by age' }, { timeout: BUDGET_MS });
    await screen.findByRole('option', { name: 'Direct Sales' }, { timeout: BUDGET_MS });
    const elapsed = performance.now() - started;

    expect(claims).toHaveTextContent(/\d{3}/);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
