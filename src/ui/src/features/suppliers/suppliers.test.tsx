import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createMockTransport } from '../../api/mockTransport';
import { captureDownloads, parseCsv } from '../../test/csv';
import { ruleConfigWith, transportOver } from '../../test/datasets';
import { renderApp, tableRows } from '../../test/renderApp';

const NAME = 'Suppliers';
const MMA = 'Mma-Motor Repairs (fictional)';
const KWENENG = 'Kweneng Assessors (fictional)';
const PULA = 'Pula Survey Specialists (fictional)';

/** The figures of each supplier row, without the supplier cell. */
const figures = () =>
  Object.fromEntries(
    tableRows(NAME).map((row) => [
      row[0]?.replace(/(Assessor|Repairer|Loss Adjuster)$/, ''),
      row.slice(1),
    ]),
  );

describe('Supplier Insights', () => {
  it('shows each supplier’s open requests, waits, breaches, cases and late actions as the fixture gives them, holds back an average on a small sample, leads to the cases behind a supplier and exports what is on screen', async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    const transport = createMockTransport();
    // A task on CLM-106 that was due two days before the as-of date: the supplier’s one late action.
    await transport('/api/v1/tasks', {
      method: 'POST',
      headers: { 'X-Tenant-Id': 'TEST', 'X-As-Of': '2026-10-21', 'X-Persona': 'head-of-claims' },
      body: JSON.stringify({
        subject_type: 'CLAIM',
        subject_id: 'CLM-106',
        due_at: '2026-10-19',
        note: 'Chase',
      }),
    });
    const view = renderApp('/suppliers', { transport });

    // By hand: REQ-CLM-101 (sent 6 Oct) and REQ-CLM-106 (2 Oct) are with Mma-Motor and still open on 21 Oct. That is 11 and 13
    // business days against a 5-day target, so the mean is 12.0, the longest 13 and both are past the target. Mma-Motor is
    // assigned CLM-101 and CLM-106; Kweneng is assigned the open CLM-102, 104 and 105 (CLM-103 is closed) and has no request.
    await screen.findByRole('table', { name: NAME });
    await waitFor(() => expect(tableRows(NAME)).toHaveLength(3));
    expect(tableRows(NAME).map((row) => row[0])).toEqual([
      `${KWENENG}Assessor`,
      `${MMA}Repairer`,
      `${PULA}Loss Adjuster`,
    ]);
    // Cells: open requests, average wait with its sample, longest, past target, assigned cases, late actions, turnaround.
    expect(figures()).toEqual({
      [KWENENG]: ['0', '—No requests', '—', '0', '3', '0', '—None completed'],
      [MMA]: ['2', '12.02 requests', '13', '2', '2', '1', '—None completed'],
      [PULA]: ['0', '—No requests', '—', '0', '0', '0', '—None completed'],
    });
    expect(
      screen.getByText(
        /against the 5-day target\. An average or percentile appears from 2 requests/,
      ),
    ).toBeInTheDocument();
    // Percentiles by nearest rank over the same two waits, 11 and 13: the median is the lower, the 90th percentile the higher,
    // both over the 5-day target. The baseline pools every supplier's waits, so here it equals Mma-Motor's. A supplier with
    // no requests is shown with its sample and no placement; nothing is ranked or sorted.
    const PERCENTILES = 'Wait percentiles by supplier';
    const BASELINE = 'All suppliers (baseline)';
    const placement = () =>
      Object.fromEntries(
        tableRows(PERCENTILES).map((row) => [
          row[0]?.replace(/Every supplier’s open waits together$/, ''),
          row.slice(1),
        ]),
      );
    expect(placement()).toEqual({
      [BASELINE]: ['2', '11Over the target', '13Over the target'],
      [KWENENG]: ['0No requests', '—', '—'],
      [MMA]: ['2', '11Over the target', '13Over the target'],
      [PULA]: ['0No requests', '—', '—'],
    });
    const chart = screen.getByRole('table', {
      name: 'Median and 90th percentile wait by supplier',
    });
    expect(
      within(chart)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual([`${BASELINE}1113`, `${MMA}1113`]);
    expect(
      within(screen.getByRole('table', { name: PERCENTILES })).queryAllByRole('button'),
    ).toHaveLength(0);
    // The list is never ranked: no column sorts it.
    expect(within(screen.getByRole('table', { name: NAME })).queryAllByRole('button')).toHaveLength(
      0,
    );

    // A filter narrows the cases before the figures are worked out: CLM-106 alone is one request, too few for an average.
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Product' }),
      'Property All Risk',
    );
    await waitFor(() => expect(figures()[MMA]?.[0]).toBe('1'));
    expect(figures()[MMA]).toEqual(['1', '—1 of 2 needed', '13', '1', '1', '1', '—None completed']);
    // One request is below the minimum, so Mma-Motor and the baseline are shown with the sample and no percentile.
    await waitFor(() =>
      expect(placement()[MMA]).toEqual(['1Not enough data: 1 of 2 needed', '—', '—']),
    );
    expect(placement()[BASELINE]).toEqual(['1Not enough data: 1 of 2 needed', '—', '—']);
    expect(
      screen.getByText(/no supplier has 2 open requests with a request time/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(figures()[MMA]?.[0]).toBe('2'));

    // CLM-AT-14: the file is the table, supplier for supplier.
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const file = await downloads.next();
    expect(file.name).toBe('claimsiq-suppliers-TEST-2026-10-21.csv');
    const csv = parseCsv(file.text);
    expect(csv[0]?.slice(0, 3)).toEqual(['Supplier', 'Supplier ID', 'Service type']);
    expect(csv[0]?.slice(5, 10)).toEqual([
      'Requests behind the average wait',
      'Median wait (business days)',
      '90th percentile wait (business days)',
      'Median against the target',
      '90th percentile against the target',
    ]);
    // Row for row the figures above; an average or percentile held back is an empty cell, and the sample sits in its own
    // column. The last row is the baseline of every supplier's waits together.
    const over = 'Over the target';
    expect(csv.slice(1)).toEqual([
      [
        KWENENG,
        'SUP-01',
        'Assessor',
        '0',
        '',
        '0',
        '',
        '',
        '',
        '',
        '',
        '0',
        '0',
        '3',
        '0',
        '',
        '0',
        '3',
      ],
      [
        MMA,
        'SUP-02',
        'Repairer',
        '2',
        '12.0',
        '2',
        '11',
        '13',
        over,
        over,
        '13',
        '2',
        '0',
        '2',
        '1',
        '',
        '0',
        '2',
      ],
      [
        PULA,
        'SUP-03',
        'Loss Adjuster',
        '0',
        '',
        '0',
        '',
        '',
        '',
        '',
        '',
        '0',
        '0',
        '0',
        '0',
        '',
        '0',
        '0',
      ],
      [BASELINE, '', '', '', '', '2', '11', '13', over, over, '', '', '', '', '', '', '', ''],
    ]);

    // Click a supplier: the Claims list shows exactly the cases behind its figures (CLM-101 and CLM-106), nothing else.
    expect(
      screen.queryByRole('link', { name: `View the cases behind ${PULA}` }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: `View the cases behind ${MMA}` }));
    expect(
      await screen.findByText(
        new RegExp(`Open claims assigned to ${MMA.replace(/[()]/g, '\\$&')}`),
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(tableRows('Claims').map((row) => row[0])).toEqual(['CLM-101', 'CLM-106']),
    );
    view.unmount();

    // The sample minimum is a rule setting: raised to 3, two requests are no longer enough for an average, while the
    // longest wait and the breaches stay what the cases say.
    const view2 = renderApp('/suppliers', {
      transport: transportOver({ ruleConfig: ruleConfigWith({ supplier_min_sample: 3 }) }),
    });
    await waitFor(() => expect(figures()[MMA]).toBeDefined());
    expect(figures()[MMA]).toEqual(['2', '—2 of 3 needed', '13', '2', '2', '0', '—None completed']);
    expect(placement()[MMA]).toEqual(['2Not enough data: 2 of 3 needed', '—', '—']);
    view2.unmount();

    // A minimum of one request reads in the singular, and no text on the page speaks of ranking suppliers, even to say it does not (the nearest-rank method is a percentile method, not a ranking).
    renderApp('/suppliers', {
      transport: transportOver({ ruleConfig: ruleConfigWith({ supplier_min_sample: 1 }) }),
    });
    await waitFor(() => expect(placement()[MMA]).toBeDefined());
    expect(screen.getByText(/appears from 1 request and always shows/)).toBeInTheDocument();
    expect(screen.getByText(/A supplier is placed from 1 request;/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/\branked\b|\branking\b|\brankings\b/i);
  });
});
