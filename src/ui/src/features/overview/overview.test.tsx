import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { formatMoney } from '../../../../contracts/index';
import { captureDownloads, parseCsv } from '../../test/csv';
import { renderApp, tableRows } from '../../test/renderApp';

const card = (name: string) => screen.getByRole('region', { name });
const group = (heading: string) => {
  const section = screen.getByRole('heading', { name: heading }).closest('section');
  if (section === null) throw new Error(`${heading} is not in a group`);
  return within(section);
};
const listed = () => tableRows('Claims').map((row) => row[0]);

describe('Overview', () => {
  it('shows the TEST figures, lists exactly the claims each card counts, narrows every figure with the filters and the as-of date, and exports what is on screen', async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    renderApp('/overview');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    // CLM-AT-01/02: 5 open and 1 closed; P9,000 paid + P68,000 reserve = P77,000 incurred.
    await screen.findByRole('region', { name: 'Open claims' });
    const figures = {
      'Open claims': '5',
      'Closed claims': '1',
      'Paid to date': 'P9,000.00',
      'Outstanding reserve': 'P68,000.00',
      Incurred: 'P77,000.00',
      'SLA breaches': '3',
      'High-value claims': '1',
      'High-priority exceptions': '3',
      // The period cards over the last 30 days, 22 Sep to 21 Oct, worked by hand from the fixture: CLM-101, 103, 104, 105
      // and 106 were reported in it (CLM-102 on 1 Sep was not); CLM-102's P5,000 was paid on 22 Sep and CLM-103's P4,000
      // on 13 Oct; CLM-103 closed on 15 Oct, 5 days after it was reported. CLM-101, 102 and 106 are High, an as-of
      // figure that the period does not narrow.
      'New claims': '5',
      'Paid in period': 'P9,000.00',
      'Average closed turnaround': '5.0 days',
    };
    for (const [label, value] of Object.entries(figures)) {
      expect(card(label)).toHaveTextContent(value);
    }
    expect(card('Average closed turnaround')).toHaveTextContent(
      'Claims averaged: 1. Left out for missing dates: 0',
    );
    const periodCards = group('Last 30 days: 22 Sep 2026 to 21 Oct 2026');
    expect(periodCards.getByText(/These cards follow the period selector/)).toBeInTheDocument();
    expect(periodCards.queryByRole('region', { name: 'High-priority exceptions' })).toBeNull();
    expect(
      group('As of 21 Oct 2026').getByRole('region', { name: 'High-priority exceptions' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Open claims by stage' })).toHaveTextContent(
      /New1.*Triage1.*Assessment2.*Negotiation0.*Approved1.*Settlement0/,
    );

    // Each card opens the Claims page with exactly the claims it counts (CLM-AT-03/04/05/07).
    const counted: Record<string, string[]> = {
      'Open claims': ['CLM-101', 'CLM-102', 'CLM-104', 'CLM-105', 'CLM-106'],
      'Closed claims': ['CLM-103'],
      'Paid to date': ['CLM-102', 'CLM-103'],
      'Outstanding reserve': ['CLM-101', 'CLM-102', 'CLM-104', 'CLM-105', 'CLM-106'],
      Incurred: ['CLM-101', 'CLM-102', 'CLM-103', 'CLM-104', 'CLM-105', 'CLM-106'],
      'SLA breaches': ['CLM-101', 'CLM-102', 'CLM-106'],
      'High-value claims': ['CLM-106'],
      'New claims': ['CLM-101', 'CLM-103', 'CLM-104', 'CLM-105', 'CLM-106'],
      'Paid in period': ['CLM-102', 'CLM-103'],
      'Average closed turnaround': ['CLM-103'],
      'High-priority exceptions': ['CLM-101', 'CLM-102', 'CLM-106'],
    };
    for (const [label, ids] of Object.entries(counted)) {
      await user.click(within(card(label)).getByRole('link'));
      await screen.findByRole('table', { name: 'Claims' });
      await waitFor(() => expect(listed()).toEqual(ids));
      if (label === 'Paid in period') {
        // The list shows the payments that make the card's P9,000: CLM-102's P5,000 and CLM-103's P4,000.
        expect(tableRows('Claims').map((row) => row[7])).toEqual(['P5,000.00', 'P4,000.00']);
      }
      await user.click(within(nav).getByRole('link', { name: 'Overview' }));
      await screen.findByRole('region', { name: 'Open claims' });
    }

    // CSV equals the screen: the same figures, the same claims counted, money as plain decimals.
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const file = await downloads.next();
    expect(file.name).toBe('claimsiq-overview-TEST-2026-10-21.csv');
    const rows = parseCsv(file.text);
    expect(rows[0]).toEqual(['Section', 'Measure', 'Claims', 'Amount (BWP)', 'Days']);
    const asOf = 'As of 21 Oct 2026';
    const period = 'Last 30 days: 22 Sep 2026 to 21 Oct 2026';
    const summary = rows.filter((row) => row[0] === asOf || row[0] === period);
    const leftOut = 'Closed in the period, left out of the average';
    expect(summary.map((row) => row[1])).toEqual(
      Object.keys(figures).flatMap((label) =>
        label === 'Average closed turnaround' ? [label, leftOut] : [label],
      ),
    );
    for (const [, measure, claims, amount, days] of summary.filter((row) => row[1] !== leftOut)) {
      const shown =
        days !== '' ? `${days} days` : claims === '' ? formatMoney(amount ?? '') : claims;
      expect(card(measure ?? '')).toHaveTextContent(shown ?? '');
    }
    expect(rows.find((row) => row[1] === 'Paid to date')).toEqual([
      asOf,
      'Paid to date',
      '',
      '9000.00',
      '',
    ]);
    expect(rows.filter((row) => row[0] === period)).toEqual([
      [period, 'New claims', '5', '', ''],
      [period, 'Paid in period', '', '9000.00', ''],
      [period, 'Average closed turnaround', '1', '', '5.0'],
      [period, leftOut, '0', '', ''],
    ]);
    expect(rows.filter((row) => row[0] === 'Open claims by stage')).toEqual([
      ['Open claims by stage', 'New', '1', '', ''],
      ['Open claims by stage', 'Triage', '1', '', ''],
      ['Open claims by stage', 'Assessment', '2', '', ''],
      ['Open claims by stage', 'Negotiation', '0', '', ''],
      ['Open claims by stage', 'Approved', '1', '', ''],
      ['Open claims by stage', 'Settlement', '0', '', ''],
    ]);

    // Broker and product filters change every figure, the list behind the cards, the CSV, and are remembered.
    expect(
      within(screen.getByLabelText('Handler'))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All handlers', 'Boitumelo Demo']);
    await user.selectOptions(screen.getByLabelText('Broker'), 'Kopano Brokers (fictional)');
    await waitFor(() => expect(card('Open claims')).toHaveTextContent('2'));
    expect(card('Incurred')).toHaveTextContent('P20,000.00');
    await user.selectOptions(screen.getByLabelText('Product'), 'Comprehensive Motor');
    await waitFor(() => expect(card('Open claims')).toHaveTextContent('1'));
    expect(card('Outstanding reserve')).toHaveTextContent('P11,000.00');
    expect(card('Paid to date')).toHaveTextContent('P0.00');
    expect(card('High-value claims')).toHaveTextContent('0');
    expect(card('New claims')).toHaveTextContent('1');
    expect(card('Paid in period')).toHaveTextContent('P0.00');
    expect(card('Average closed turnaround')).toHaveTextContent('—');
    expect(window.localStorage.getItem('ciq.filters')).toContain('BRK-01');
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const narrowed = parseCsv((await downloads.next()).text);
    expect(narrowed.find((row) => row[1] === 'Open claims')).toEqual([
      asOf,
      'Open claims',
      '1',
      '',
      '',
    ]);
    expect(narrowed.find((row) => row[1] === 'New claims')?.[2]).toBe('1');
    await user.click(within(card('Open claims')).getByRole('link'));
    await waitFor(() => expect(listed()).toEqual(['CLM-101']));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(listed()).toHaveLength(5));
    await user.click(within(nav).getByRole('link', { name: 'Overview' }));

    // The period choice moves only the period cards, and is remembered with the filters. 7 days: 15 to 21 Oct, so only CLM-104
    // and CLM-105 are new, no payment falls in it (the last was 13 Oct) and CLM-103's closing on 15 Oct does. Month to date
    // starts on 1 Oct: CLM-106 (25 Sep) is no longer new and CLM-102's payment of 22 Sep drops out, leaving CLM-103's P4,000.
    await user.selectOptions(screen.getByLabelText('Period'), 'Last 7 days');
    expect(
      await screen.findByRole('heading', { name: 'Last 7 days: 15 Oct 2026 to 21 Oct 2026' }),
    ).toBeInTheDocument();
    expect(card('New claims')).toHaveTextContent('2');
    expect(card('Paid in period')).toHaveTextContent('P0.00');
    expect(card('Average closed turnaround')).toHaveTextContent('5.0 days');
    expect(card('Open claims')).toHaveTextContent('5');
    expect(window.localStorage.getItem('ciq.filters')).toContain('"period":"7d"');
    await user.selectOptions(screen.getByLabelText('Period'), 'Month to date');
    await waitFor(() => expect(card('New claims')).toHaveTextContent('4'));
    expect(card('Paid in period')).toHaveTextContent('P4,000.00');
    await user.selectOptions(screen.getByLabelText('Period'), 'Last 30 days');
    await waitFor(() => expect(card('Paid in period')).toHaveTextContent('P9,000.00'));

    // The as-of date changes every figure: on 5 October CLM-103, 104 and 105 are not reported yet and CLM-101's reserve is still P8,000.
    fireEvent.change(screen.getByLabelText('As of'), { target: { value: '2026-10-05' } });
    await waitFor(() => expect(card('Open claims')).toHaveTextContent('3'));
    expect(card('Closed claims')).toHaveTextContent('0');
    expect(card('Outstanding reserve')).toHaveTextContent('P50,000.00');
    expect(card('Incurred')).toHaveTextContent('P55,000.00');
    expect(card('New claims')).toHaveTextContent('2');
    expect(card('Paid in period')).toHaveTextContent('P5,000.00');

    // Before the first claim there is nothing to summarize, and the filters stay to widen the view.
    fireEvent.change(screen.getByLabelText('As of'), { target: { value: '2026-01-01' } });
    expect(await screen.findByText('No claims to summarize')).toBeInTheDocument();
    expect(screen.getByLabelText('Broker')).toBeInTheDocument();
  });

  it('moves the DEMO period cards and the paid chart with the period, from July to October', async () => {
    const user = userEvent.setup();
    renderApp('/overview', { dataSet: 'DEMO' });
    await screen.findByRole('region', { name: 'Open claims' });

    // DEMO's 20 payments run from 20 Jul to 20 Oct and its 5 closings from 14 Aug to 19 Oct (fixtures/v2), so each window
    // holds different claims; the turnaround is the mean of the closings in the window (the 2 of the last 7 days: 79.0).
    const byPeriod = {
      'Last 7 days': { new: '0', paid: 'P4,500.00', turnaround: '79.0 days' },
      'Last 30 days': { new: '6', paid: 'P28,000.00', turnaround: '74.7 days' },
      'Last 90 days': { new: '25', paid: 'P66,500.00', turnaround: '60.2 days' },
    };
    for (const [period, expected] of Object.entries(byPeriod)) {
      await user.selectOptions(screen.getByLabelText('Period'), period);
      await waitFor(() => expect(card('New claims')).toHaveTextContent(expected.new));
      expect(card('Paid in period')).toHaveTextContent(expected.paid);
      expect(card('Average closed turnaround')).toHaveTextContent(expected.turnaround);
    }

    await waitFor(() => expect(card('Paid by month')).toHaveTextContent('Oct 2026'));
    expect(
      within(screen.getByRole('table', { name: 'Posted paid by month' }))
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual([
      'Jul 2026P17,000.00',
      'Aug 2026P7,500.00',
      'Sep 2026P36,000.00',
      'Oct 2026P17,000.00',
    ]);
    expect(card('Paid by month')).not.toHaveTextContent('All posted payments fall in');
  });
});
