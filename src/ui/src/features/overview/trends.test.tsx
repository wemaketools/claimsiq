import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { captureDownloads, parseCsv } from '../../test/csv';
import { renderApp } from '../../test/renderApp';

const CHART = 'Posted paid by month';
const months = () =>
  within(screen.getByRole('table', { name: CHART }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent);

describe('Overview paid by month', () => {
  it('buckets the posted payments by month up to the as-of date, follows the filters and the as-of date, says when nothing is posted and exports the months with their total', async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    renderApp('/overview');

    // TEST: CLM-102's P5,000 was posted on 22 Sep and CLM-103's P4,000 on 13 Oct, so two months that add up to Paid to date.
    await waitFor(() => expect(months()).toEqual(['Sep 2026P5,000.00', 'Oct 2026P4,000.00']));
    expect(screen.getByRole('region', { name: 'Paid by month' })).toHaveTextContent(
      'P9,000.00 posted on 2 payments over 2 months.',
    );
    expect(screen.getByRole('region', { name: 'Paid to date' })).toHaveTextContent('P9,000.00');

    // The period selector narrows the period cards and not this chart.
    await user.selectOptions(screen.getByLabelText('Period'), 'Last 7 days');
    await screen.findByRole('heading', { name: 'Last 7 days: 15 Oct 2026 to 21 Oct 2026' });
    expect(months()).toEqual(['Sep 2026P5,000.00', 'Oct 2026P4,000.00']);
    await user.selectOptions(screen.getByLabelText('Period'), 'Last 30 days');

    // CSV: a row per month in the Overview columns (claims paid on, amount) and the total, which is the Paid to date card.
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const rows = parseCsv((await downloads.next()).text).filter(
      (row) => row[0] === 'Paid by month',
    );
    expect(rows).toEqual([
      ['Paid by month', 'Sep 2026', '1', '5000.00', ''],
      ['Paid by month', 'Oct 2026', '1', '4000.00', ''],
      ['Paid by month', 'Posted paid to date', '', '9000.00', ''],
    ]);

    // Kopano Brokers holds CLM-101 and CLM-104, which have no posted payment, so nothing is posted for them.
    await user.selectOptions(screen.getByLabelText('Broker'), 'Kopano Brokers (fictional)');
    expect(await screen.findByText('No posted payments yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(months()).toHaveLength(2));

    // On 10 Oct the 13 Oct payment is not posted yet: October is a month of 0.00, not a gap, and stops at the as-of date.
    fireEvent.change(screen.getByLabelText('As of'), { target: { value: '2026-10-10' } });
    await waitFor(() => expect(months()).toEqual(['Sep 2026P5,000.00', 'Oct 2026P0.00']));
    expect(screen.getByRole('region', { name: 'Paid by month' })).toHaveTextContent(
      'P5,000.00 posted on 1 payments',
    );
  });
});
