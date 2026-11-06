import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { endpoints, formatMoney } from '../../../../contracts/index';
import { call } from '../../api/client';
import { csvCell, toCsv } from '../../lib/csv';
import { captureDownloads, parseCsv } from '../../test/csv';
import { renderApp, tableRows } from '../../test/renderApp';

const listed = () => tableRows('Claims').map((row) => row[0]);

describe('Claims list', () => {
  it('lists the DEMO claims with sorting and paging, narrows them by filter and by the criterion in the address, and exports exactly the filtered list in the order on screen', async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    const { router } = renderApp('/claims', { dataSet: 'DEMO' });
    const { items } = await call(endpoints.claimsFacts);

    await screen.findByRole('table', { name: 'Claims' });
    await waitFor(() => expect(listed()).toHaveLength(25));
    expect(screen.getByText(/Showing 1–25 of 30/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(listed()).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Page 1' }));

    // Incurred, largest first; ties keep claim order.
    await user.click(screen.getByRole('button', { name: 'Incurred' }));
    await user.click(screen.getByRole('button', { name: 'Incurred' }));
    const byIncurred = [...items]
      .sort(
        (a, b) => Number(b.incurred) - Number(a.incurred) || a.claim_id.localeCompare(b.claim_id),
      )
      .map((fact) => fact.claim_id);
    expect(listed()).toEqual(byIncurred.slice(0, 25));

    // CLM-AT-14: the CSV is the whole filtered list, row for row what the table shows.
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const file = await downloads.next();
    expect(file.name).toBe('claimsiq-claims-DEMO-2026-10-21.csv');
    const csv = parseCsv(file.text);
    expect(csv[0]).toEqual([
      'Claim ID',
      'Client',
      'Product',
      'Stage',
      'Age (days)',
      'Handler',
      'Paid (BWP)',
      'Reserve (BWP)',
      'Incurred (BWP)',
      'SLA',
      'Severity',
    ]);
    expect(csv.slice(1).map((row) => row[0])).toEqual(byIncurred);
    const dash = (text: string | undefined) => (text === '' ? '—' : text);
    const asScreen = csv
      .slice(1, 26)
      .map((row) => [
        row[0],
        row[1],
        row[2],
        row[3],
        dash(row[4]),
        row[5],
        formatMoney(row[6] ?? ''),
        formatMoney(row[7] ?? ''),
        formatMoney(row[8] ?? ''),
        dash(row[9]),
        dash(row[10]),
      ]);
    expect(asScreen).toEqual(tableRows('Claims').map((row) => row.slice(0, 11)));
    const paidTotal = csv.slice(1).reduce((sum, row) => sum + Number(row[6]), 0);
    expect(paidTotal).toBe(77500);

    // Filters narrow the list and its export together, and a closed claim shows no SLA or severity.
    await user.selectOptions(screen.getByLabelText('Broker'), 'Kopano Brokers (fictional)');
    const kopano = await call(endpoints.claimsFacts, { query: { broker_id: 'BRK-01' } });
    await waitFor(() => expect(listed()).toHaveLength(kopano.items.length));
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const narrowed = parseCsv((await downloads.next()).text);
    expect(narrowed.slice(1).map((row) => row[0])).toEqual(listed());
    expect(tableRows('Claims').filter((row) => row[9] === '—').length).toBe(
      kopano.items.filter((fact) => !fact.is_open).length,
    );

    // The criterion in the address selects from the filtered claims and says what it shows.
    await act(() => router.navigate('/claims?show=high-value'));
    expect(await screen.findByText(/Showing: High-value open claims/)).toBeInTheDocument();
    expect(listed()).toEqual(
      kopano.items
        .filter((fact) => fact.is_open && fact.high_value)
        .map((fact) => fact.claim_id)
        .sort(),
    );
    await user.click(screen.getByRole('link', { name: 'Show all claims' }));
    await waitFor(() => expect(listed()).toHaveLength(kopano.items.length));
    await act(() => router.navigate('/claims?show=stage:Closed'));
    expect(await screen.findByText(/not one the Claims page knows/)).toBeInTheDocument();

    // Nothing reported yet: a different message when the filter is what empties the list.
    fireEvent.change(screen.getByLabelText('As of'), { target: { value: '2026-01-01' } });
    expect(await screen.findByText('No claims match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('No claims to list')).toBeInTheDocument();
  });

  it('quotes cells, keeps amounts and counts as plain numbers, and stops a text cell from running as a spreadsheet formula', () => {
    expect(csvCell('Kgale, Fleet "North"')).toBe('"Kgale, Fleet ""North"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-5')).toBe('-5');
    expect(csvCell('9000.00')).toBe('9000.00');
    expect(
      toCsv([
        ['a', 'b'],
        ['1', ''],
      ]),
    ).toBe('a,b\r\n1,\r\n');
  });
});
