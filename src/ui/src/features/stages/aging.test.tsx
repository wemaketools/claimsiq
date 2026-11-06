import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { endpoints, formatMoney } from '../../../../contracts/index';
import { call } from '../../api/client';
import type { ApiTransport } from '../../api/client';
import { captureDownloads, parseCsv } from '../../test/csv';
import { fixtureFiles, transportOver } from '../../test/datasets';
import { renderApp, tableRows } from '../../test/renderApp';

const listed = () => tableRows('Claims').map((row) => row[0]);
const footer = (title: string) =>
  within(screen.getByRole('heading', { name: title }).closest('section') as HTMLElement).getByText(
    /^All open claims/,
  );

describe('Stages & Aging', () => {
  it('shows open claims by stage and by the five age buckets as the engine counts them, opens the claims behind a row, follows the filters, and exports what is on screen', async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    renderApp('/stages');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    // CLM-AT-03: open stage counts sum to 5 and Closed is not among them.
    await screen.findByRole('table', { name: 'Open claims and their value by stage' });
    const stageTable = 'Open claims and their value by stage';
    const ageTable = 'Open claims and their value by age';
    expect(tableRows(stageTable)).toEqual([
      ['New', '1', 'P0.00', 'P6,000.00', 'P6,000.00', ''],
      ['Triage', '1', 'P5,000.00', 'P12,000.00', 'P17,000.00', ''],
      ['Assessment', '2', 'P0.00', 'P41,000.00', 'P41,000.00', ''],
      ['Negotiation', '0', 'P0.00', 'P0.00', 'P0.00', ''],
      ['Approved', '1', 'P0.00', 'P9,000.00', 'P9,000.00', ''],
      ['Settlement', '0', 'P0.00', 'P0.00', 'P0.00', ''],
    ]);
    expect(tableRows(ageTable).map((row) => row.slice(0, 2))).toEqual([
      ['0-7 days', '2'],
      ['8-30 days', '2'],
      ['31-60 days', '1'],
      ['61-90 days', '0'],
      ['>90 days', '0'],
    ]);
    expect(footer('Stage detail')).toHaveTextContent(
      'All open claims: 5 · P5,000.00 · P68,000.00 · P73,000.00',
    );
    expect(footer('Age detail')).toHaveTextContent('All open claims: 5');

    // The tables show what the engine's summary says.
    const { summary } = await call(endpoints.claimsFacts);
    expect(tableRows(stageTable).map((row) => row.slice(0, 5))).toEqual(
      summary.by_stage
        .filter((row) => row.stage !== 'Closed' && row.stage !== 'Reopened')
        .map((row) => [
          row.stage,
          String(row.count),
          formatMoney(row.paid),
          formatMoney(row.reserve),
          formatMoney(row.incurred),
        ]),
    );
    expect(screen.getByRole('figure', { name: 'Open claims by stage' })).toHaveTextContent(
      /Assessment.*2/,
    );

    // Stage value is incurred (paid plus reserve) of the open claims, drawn beside the counts.
    expect(screen.getByRole('list', { name: 'Open incurred by stage' })).toHaveTextContent(
      /Triage.*P17,000\.00.*Assessment.*P41,000\.00/,
    );

    // The same open claims by product, broker and owner, each tab adding up to the 5 open claims (worked by hand:
    // CLM-102 and CLM-106 are Property, 101 and 105 Motor, 104 Personal Accident; 103 is closed).
    const groupTable = (group: string) => `Open claims and their value by ${group}`;
    const columnsOf = (name: string) => tableRows(name).map((row) => row.slice(0, 5));
    await screen.findByRole('table', { name: groupTable('Product') });
    expect(columnsOf(groupTable('Product'))).toEqual([
      ['Property All Risk', '2', 'P5,000.00', 'P42,000.00', 'P47,000.00'],
      ['Comprehensive Motor', '2', 'P0.00', 'P17,000.00', 'P17,000.00'],
      ['Personal Accident', '1', 'P0.00', 'P9,000.00', 'P9,000.00'],
    ]);
    await user.click(screen.getByRole('tab', { name: 'Broker' }));
    expect(columnsOf(groupTable('Broker'))).toEqual([
      ['Direct Sales', '1', 'P0.00', 'P30,000.00', 'P30,000.00'],
      ['Tsholofelo Risk Advisors (fictional)', '2', 'P5,000.00', 'P18,000.00', 'P23,000.00'],
      ['Kopano Brokers (fictional)', '2', 'P0.00', 'P20,000.00', 'P20,000.00'],
    ]);
    await user.click(screen.getByRole('tab', { name: 'Owner' }));
    expect(columnsOf(groupTable('Owner'))).toEqual([
      ['Boitumelo Demo', '5', 'P5,000.00', 'P68,000.00', 'P73,000.00'],
    ]);
    await user.click(screen.getByRole('tab', { name: 'Product' }));

    // A row opens exactly the claims it counts, by stage and by age.
    await user.click(screen.getByRole('link', { name: 'Open claims: Assessment' }));
    await waitFor(() => expect(listed()).toEqual(['CLM-101', 'CLM-106']));
    expect(screen.getByText(/Showing: Open claims in Assessment/)).toBeInTheDocument();
    await user.click(within(nav).getByRole('link', { name: 'Stages & Aging' }));
    await user.click(await screen.findByRole('link', { name: 'Open claims: 0-7 days' }));
    await waitFor(() => expect(listed()).toEqual(['CLM-104', 'CLM-105']));
    await user.click(within(nav).getByRole('link', { name: 'Stages & Aging' }));

    // A filter narrows both tables and their totals; the export is that view.
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Product' }),
      'Property All Risk',
    );
    await waitFor(() => expect(footer('Stage detail')).toHaveTextContent('All open claims: 2'));
    expect(
      tableRows(stageTable)
        .filter((row) => row[1] !== '0')
        .map((row) => row[0]),
    ).toEqual(['Triage', 'Assessment']);
    expect(tableRows(ageTable).map((row) => row[1])).toEqual(['0', '1', '1', '0', '0']);
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const file = await downloads.next();
    expect(file.name).toBe('claimsiq-stages-TEST-2026-10-21.csv');
    const csv = parseCsv(file.text);
    expect(csv[0]).toEqual([
      'Section',
      'Item',
      'Claims',
      'Paid (BWP)',
      'Reserve (BWP)',
      'Incurred (BWP)',
    ]);
    // On screen after the Property filter: the stage and age tables and each tab of the group table.
    const onScreen = [
      ...columnsOf(stageTable),
      ...columnsOf(ageTable),
      ...columnsOf(groupTable('Product')),
    ];
    await user.click(screen.getByRole('tab', { name: 'Broker' }));
    onScreen.push(...columnsOf(groupTable('Broker')));
    await user.click(screen.getByRole('tab', { name: 'Owner' }));
    onScreen.push(...columnsOf(groupTable('Owner')));
    const exported = csv
      .slice(1, -1)
      .map(([, item, claims, paid, reserve, incurred]) => [
        item,
        claims,
        formatMoney(paid ?? ''),
        formatMoney(reserve ?? ''),
        formatMoney(incurred ?? ''),
      ]);
    expect(exported).toEqual(onScreen);
    expect(csv.at(-1)).toEqual([
      'All open claims',
      'All open claims',
      '2',
      '5000.00',
      '42000.00',
      '47000.00',
    ]);

    // The data set switch clears the filters; DEMO's stages add up to its 25 open claims.
    await user.selectOptions(screen.getByLabelText('Data set'), 'DEMO');
    await waitFor(() => expect(footer('Stage detail')).toHaveTextContent('All open claims: 25'));
    expect(screen.getByRole('combobox', { name: 'Product' })).toHaveValue('');
    const stageCounts = tableRows(stageTable).reduce((sum, row) => sum + Number(row[1]), 0);
    const ageCounts = tableRows(ageTable).reduce((sum, row) => sum + Number(row[1]), 0);
    expect([stageCounts, ageCounts]).toEqual([25, 25]);
  });

  it('lists open claims with no reported date or no dated stage event apart from the buckets, and Overview flags what it leaves out of the turnaround and counts only posted payments as paid', async () => {
    const user = userEvent.setup();
    const files = fixtureFiles('test');
    const transport = transportOver({
      TEST: {
        ...files,
        // CLM-104 (open) and CLM-103 (closed) have no reported date.
        'claims.csv': (files['claims.csv'] ?? '')
          .replace('TEST,CLM-104,POL-004,2026-10-15,2026-10-15', 'TEST,CLM-104,POL-004,2026-10-15,')
          .replace(
            'TEST,CLM-103,POL-003,2026-10-10,2026-10-10',
            'TEST,CLM-103,POL-003,2026-10-10,',
          ),
        // A pending and a void payment inside the period, which are not paid.
        'claim_payments.csv': `${files['claim_payments.csv'] ?? ''}TEST,CPAY-X1,CLM-104,2026-10-20,1000,BWP,SYN-PAY-X1,PENDING\nTEST,CPAY-X2,CLM-105,2026-10-20,2000,BWP,SYN-PAY-X2,VOID\n`,
        'claim_events.csv': (files['claim_events.csv'] ?? '')
          .split('\n')
          .filter((line) => !line.includes('CLM-105'))
          .join('\n'),
      },
    });
    renderApp('/stages', { transport });

    const stages = await screen.findByRole('table', {
      name: 'Open claims and their value by stage',
    });
    expect(within(stages).getByText('Unknown')).toBeInTheDocument();
    expect(tableRows('Open claims and their value by age').at(-1)?.slice(0, 2)).toEqual([
      'Age unknown',
      '1',
    ]);
    expect(footer('Stage detail')).toHaveTextContent('All open claims: 5');

    await user.click(screen.getByRole('link', { name: 'Open claims: Age unknown' }));
    await waitFor(() => expect(listed()).toEqual(['CLM-104']));

    // Overview says what it leaves out: CLM-103 closed in the period but has no reported date, so it is out of the
    // average and counted; CLM-104 and CLM-103 are not new in the period; and only posted payments are paid in it.
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    await user.click(within(nav).getByRole('link', { name: 'Overview' }));
    const card = (name: string) => screen.getByRole('region', { name });
    await screen.findByRole('region', { name: 'Open claims' });
    expect(card('Average closed turnaround')).toHaveTextContent('—');
    expect(card('Average closed turnaround')).toHaveTextContent(
      'Claims averaged: 0. Left out for missing dates: 1',
    );
    expect(card('New claims')).toHaveTextContent('3');
    expect(card('Paid in period')).toHaveTextContent('P9,000.00');
    expect(card('Paid in period')).toHaveTextContent('Posted payments on 2 claims');
    await user.click(within(card('Paid in period')).getByRole('link'));
    await waitFor(() => expect(listed()).toEqual(['CLM-102', 'CLM-103']));
  });

  it('offers the export only once everything the screen shows has loaded, and the file then has every section of the screen', async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    const healthy = transportOver({});
    // The names behind the product, broker and owner rows arrive after the figures do.
    let slowFigures = false;
    const slowNames: ApiTransport = async (url, init) => {
      if (slowFigures && url.includes('/claim-facts')) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (/\/api\/v1\/(users|brokers|products)(\?|$)/.test(url)) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      return healthy(url, init);
    };
    renderApp('/stages', { transport: slowNames });

    await screen.findByRole('table', { name: 'Open claims and their value by stage' });
    const button = screen.getByRole('button', { name: 'Export CSV' });
    expect(button).toBeDisabled();
    expect(screen.queryByRole('tab', { name: 'Owner' })).not.toBeInTheDocument();

    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByRole('tab', { name: 'Owner' })).toBeInTheDocument();
    await user.click(button);
    const sections = new Set(
      parseCsv((await downloads.next()).text)
        .slice(1)
        .map((row) => row[0]),
    );
    expect([...sections]).toEqual([
      'Open claims by stage',
      'Open claims by age',
      'Open claims and their value by Product',
      'Open claims and their value by Broker',
      'Open claims and their value by Owner',
      'All open claims',
    ]);

    // While new figures are on their way the screen still shows the old ones, so the export waits for the new ones too.
    slowFigures = true;
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Product' }),
      'Property All Risk',
    );
    expect(button).toBeDisabled();
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    const narrowed = parseCsv((await downloads.next()).text);
    expect(narrowed.at(-1)).toEqual([
      'All open claims',
      'All open claims',
      '2',
      '5000.00',
      '42000.00',
      '47000.00',
    ]);
  });
});
