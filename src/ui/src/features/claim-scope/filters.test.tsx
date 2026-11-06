import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { endpoints, sumMoney } from '../../../../contracts/index';
import type { DataSetId } from '../../../../contracts/index';
import type { ApiTransport } from '../../api/client';
import { transportOver } from '../../test/datasets';
import { renderApp } from '../../test/renderApp';
import { overviewFigures } from '../overview/figures';
import { matchesCriterion } from './criteria';
import { ageRows, stageRows } from './stageAgeRows';

const MONEY_FIELD: Record<string, 'paid' | 'reserve' | 'incurred' | 'paid_in_period'> = {
  paid: 'paid',
  reserve: 'reserve',
  incurred: 'incurred',
  paidInPeriod: 'paid_in_period',
} as const;
const TENANT = { TEST: 'TEST', DEMO: 'DEMO' } as const;

async function ask(transport: ApiTransport, dataSet: DataSetId, asOf: string, query = '') {
  const response = await transport(`${endpoints.claimsFacts.path}${query}`, {
    headers: { 'X-Tenant-Id': TENANT[dataSet], 'X-As-Of': asOf },
  });
  return endpoints.claimsFacts.response.parse(await response.json());
}

describe('the shared filters and as-of date', () => {
  it('give figures that agree with the claims they count for every data set, date and filter, and the filter values split the claims without overlap or loss', async () => {
    const transport = transportOver({});
    for (const dataSet of ['TEST', 'DEMO'] as const) {
      const brokers = ['BRK-01', 'BRK-02', 'BRK-03'];
      const products = ['PRD-01', 'PRD-02', 'PRD-03', 'PRD-04'];
      for (const asOf of ['2026-10-21', '2026-10-05', '2026-09-10']) {
        const everything = await ask(transport, dataSet, asOf);
        const views = [
          '',
          '?broker_id=BRK-01',
          '?product_id=PRD-02',
          '?handler_id=USR-CLM',
          '?broker_id=BRK-02&product_id=PRD-01&handler_id=USR-CLM',
          '?period=7d',
          '?period=mtd&broker_id=BRK-01',
          '?period=90d',
        ];
        for (const query of views) {
          const { items, summary, breakdowns } = await ask(transport, dataSet, asOf, query);
          expect(summary.claims).toBe(items.length);

          // Every card counts the claims its criterion selects, and the money cards add up over exactly those claims.
          for (const figure of overviewFigures(summary).flatMap((group) => group.figures)) {
            const selected = items.filter((fact) => matchesCriterion(figure.criterion, fact));
            const { claims, amount, days } = figure.exported;
            if (days !== '') {
              const turnarounds = selected.flatMap((fact) => fact.closed_turnaround_days ?? []);
              expect(String(turnarounds.length)).toBe(claims);
              expect(
                (turnarounds.reduce((sum, d) => sum + d, 0) / turnarounds.length).toFixed(1),
              ).toBe(days);
            } else if (claims !== '') {
              expect(selected).toHaveLength(Number(claims));
            } else {
              const field = MONEY_FIELD[figure.id];
              expect(sumMoney(selected.map((fact) => fact[field ?? 'paid']))).toBe(amount);
            }
          }
          for (const row of [...stageRows(summary), ...ageRows(summary)]) {
            expect(items.filter((fact) => matchesCriterion(row.criterion, fact))).toHaveLength(
              row.count,
            );
          }
          // The breakdowns hold the open claims once each, whatever they are grouped by.
          for (const rows of Object.values(breakdowns)) {
            expect(rows.reduce((sum, row) => sum + row.claims, 0)).toBe(summary.open);
            expect(sumMoney(rows.map((row) => row.incurred))).toBe(summary.open_totals.incurred);
          }
          const staged = stageRows(summary).reduce((sum, row) => sum + row.count, 0);
          const aged = ageRows(summary).reduce((sum, row) => sum + row.count, 0);
          expect([staged, aged]).toEqual([summary.open, summary.open]);
        }

        // Each filter's values partition the unfiltered claims: nothing counted twice or dropped (CLM-AT-12).
        const handlers = [...new Set(everything.items.map((fact) => fact.handler_id))];
        for (const [key, values] of [
          ['broker_id', brokers],
          ['product_id', products],
          ['handler_id', handlers],
        ] as const) {
          const parts = await Promise.all(
            values.map((value) => ask(transport, dataSet, asOf, `?${key}=${value}`)),
          );
          expect(parts.reduce((sum, part) => sum + part.summary.claims, 0)).toBe(
            everything.summary.claims,
          );
          expect(sumMoney(parts.map((part) => part.summary.totals.incurred))).toBe(
            everything.summary.totals.incurred,
          );
          expect(parts.reduce((sum, part) => sum + part.summary.sla.breached, 0)).toBe(
            everything.summary.sla.breached,
          );
        }
      }
    }
  });

  it('shows a failed load with Try again on Overview, Stages & Aging and Claims, and each recovers', async () => {
    const user = userEvent.setup();
    const healthy = transportOver({});
    for (const [route, recovered] of [
      ['/overview', () => screen.findByRole('region', { name: 'Open claims' })],
      [
        '/stages',
        () => screen.findByRole('table', { name: 'Open claims and their value by stage' }),
      ],
      ['/claims', () => screen.findByRole('table', { name: 'Claims' })],
    ] as const) {
      let failed = false;
      const flaky: ApiTransport = (url, init) => {
        if (!failed && url.includes('/claim-facts')) {
          failed = true;
          return Promise.reject(new TypeError('The network is down'));
        }
        return healthy(url, init);
      };
      const { unmount } = renderApp(route, { transport: flaky });

      expect(await screen.findByText('This could not be loaded')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await recovered()).toBeInTheDocument();
      unmount();
    }
  });
});
