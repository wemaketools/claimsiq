import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { ApiTransport } from '../../api/client';
import { createMockTransport } from '../../api/mockTransport';
import { captureDownloads, parseCsv } from '../../test/csv';
import { renderApp, tableRows } from '../../test/renderApp';

const NAME = 'Exceptions';
const listed = () => tableRows(NAME).map((row) => row[0]);
const rowOf = (claim: string): HTMLElement =>
  screen.getByRole('link', { name: claim }).closest('tr') as HTMLElement;

/** The reasons of a row as the screen shows them, in the form the CSV writes them. */
function reasonsOf(row: HTMLElement): string {
  return within(row)
    .getAllByRole('listitem')
    .map((item) => {
      const [label, key, text] = Array.from(item.children).map((child) => child.textContent);
      return `${label} (${key}): ${text}`;
    })
    .join('; ');
}

describe('Exceptions & SLA', () => {
  it('lists the open claims that need review with severity, reasons, owner and days late, sorts and filters them, exports what is on screen, and opens a follow-up task from a row', async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    // The first read of the tasks fails: the queue still lists the claims, says the tasks are unknown, and retries.
    const mock = createMockTransport();
    let tasksFailed = false;
    const transport: ApiTransport = (url, init) => {
      if (!tasksFailed && url.startsWith('/api/v1/tasks')) {
        tasksFailed = true;
        return Promise.resolve(
          new Response(JSON.stringify({ type: 'about:blank', title: 'Down', status: 500 }), {
            status: 500,
            headers: { 'content-type': 'application/problem+json' },
          }),
        );
      }
      return mock(url, init);
    };
    renderApp('/exceptions', { transport });

    // CLM-101, 102, 105 and 106 are flagged; 103 is closed and 104 (approved, within target) has nothing to review.
    await screen.findByRole('table', { name: NAME });
    await waitFor(() => expect(listed()).toEqual(['CLM-102', 'CLM-106', 'CLM-101', 'CLM-105']));
    expect(screen.getByText('4 claims need review: 3 High, 0 Medium, 1 Low.')).toBeInTheDocument();
    expect(await screen.findByText('The open tasks could not be loaded')).toBeInTheDocument();
    expect(tableRows(NAME).map((row) => row[7])).toEqual(['—', '—', '—', '—']);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(tableRows(NAME).map((row) => row[7])).toEqual(['0', '0', '0', '0']));
    expect(screen.queryByText('The open tasks could not be loaded')).not.toBeInTheDocument();
    expect(tableRows(NAME).map((row) => [row[0], row[1], row[3], row[4], row[5], row[6]])).toEqual([
      ['CLM-102', 'High', 'Boitumelo Demo', '31', 'Triage', 'P17,000.00'],
      ['CLM-106', 'High', 'Boitumelo Demo', '10', 'Assessment', 'P30,000.00'],
      ['CLM-101', 'High', 'Boitumelo Demo', '8', 'Assessment', 'P11,000.00'],
      ['CLM-105', 'Low', 'Boitumelo Demo', '—', 'New', 'P6,000.00'],
    ]);

    // Each reason names its rule and the data that triggered it.
    expect(rowOf('CLM-102')).toHaveTextContent(
      'SLA_LATETriage: 31 business days over a 3-day target',
    );
    expect(rowOf('CLM-106')).toHaveTextContent(
      'HIGH_VALUE_DELAYEDIncurred P30,000.00 is at or above the P25,000.00 high-value line and the claim is delayed',
    );
    expect(rowOf('CLM-106')).toHaveTextContent('Assessment: 10 business days over a 5-day target');
    expect(rowOf('CLM-106')).toHaveTextContent(
      'Request REQ-CLM-106: waiting 13 business days against a 5-day target',
    );
    expect(rowOf('CLM-101')).toHaveTextContent(
      'Reserve moved up P3,000.00, P8,000.00 to P11,000.00 (at least 30% of the earlier amount)',
    );
    expect(rowOf('CLM-105')).toHaveTextContent('SLA_APPROACHING');
    // Flags are review cues: the page never says fraud or leakage.
    expect(document.body.textContent).not.toMatch(/fraud|leakage/i);

    // Sorting: by days late both ways (a claim with nothing late sorts as least late).
    await user.click(screen.getByRole('button', { name: /^Days late/ }));
    expect(listed()).toEqual(['CLM-105', 'CLM-101', 'CLM-106', 'CLM-102']);
    await user.click(screen.getByRole('button', { name: /^Days late/ }));
    expect(listed()).toEqual(['CLM-102', 'CLM-106', 'CLM-101', 'CLM-105']);
    await user.click(screen.getByRole('button', { name: /^Severity/ }));
    expect(listed()).toEqual(['CLM-102', 'CLM-106', 'CLM-101', 'CLM-105']);

    // Filters: severity, reason and the shared claim filters narrow the list; no match says so.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Severity' }), 'Low');
    expect(listed()).toEqual(['CLM-105']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Severity' }), 'Medium');
    expect(await screen.findByText('No exceptions match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Reason' }), 'Supplier delay');
    expect(listed()).toEqual(['CLM-106', 'CLM-101']);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Product' }),
      'Property All Risk',
    );
    await waitFor(() => expect(listed()).toEqual(['CLM-106']));

    // CLM-AT-14: the CSV is the filtered list, row for row what the screen shows.
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(listed()).toHaveLength(4));
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const file = await downloads.next();
    expect(file.name).toBe('claimsiq-exceptions-TEST-2026-10-21.csv');
    const csv = parseCsv(file.text);
    expect(csv[0]).toEqual([
      'Claim ID',
      'Severity',
      'Why it needs review',
      'Owner',
      'Days late',
      'Stage',
      'Incurred (BWP)',
      'Open tasks',
    ]);
    const onScreen = tableRows(NAME);
    expect(csv.slice(1).map((row) => row[0])).toEqual(onScreen.map((row) => row[0]));
    for (const row of csv.slice(1)) {
      const [claim, severity, reasons, owner, late, stage, incurred] = row;
      const shown = onScreen.find((cells) => cells[0] === claim);
      expect([severity, owner, stage]).toEqual([shown?.[1], shown?.[3], shown?.[5]]);
      expect(late === '' ? '—' : late).toBe(shown?.[4]);
      expect(`P${Number(incurred).toLocaleString('en', { minimumFractionDigits: 2 })}`).toBe(
        shown?.[6],
      );
      expect(reasons).toBe(reasonsOf(rowOf(claim ?? '')));
    }

    // A follow-up task from a row: the next action is required, and the result shows on the row and on the claim.
    await user.click(screen.getByRole('button', { name: 'Create follow-up task for CLM-106' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a follow-up task' });
    const create = within(dialog).getByRole('button', { name: 'Create task' });
    expect(create).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Priority' })).toHaveValue('HIGH');
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Assign to' }),
      'Mpho Demo',
    );
    await user.type(
      within(dialog).getByRole('textbox', { name: /Next action/ }),
      'Chase the repair estimate',
    );
    await user.click(create);
    expect(await screen.findByText('Task TASK-0001 created for CLM-106.')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(rowOf('CLM-106')).getAllByRole('cell')[7]).toHaveTextContent('1'),
    );

    await user.click(screen.getByRole('link', { name: 'CLM-106' }));
    expect(
      await screen.findByRole('heading', { name: 'Claim CLM-106', level: 1 }),
    ).toBeInTheDocument();
    const tasks = (await screen.findByRole('heading', { name: 'Follow-up tasks' })).closest(
      'section',
    ) as HTMLElement;
    expect(await within(tasks).findByText('TASK-0001')).toBeInTheDocument();
    expect(within(tasks).getByText('Chase the repair estimate')).toBeInTheDocument();
    expect(within(tasks).getByText(/Assigned to: Mpho Demo/)).toBeInTheDocument();
    expect(within(tasks).getByText('Created as Open')).toBeInTheDocument();
    expect(within(tasks).getByText('Assigned to Mpho Demo')).toBeInTheDocument();
    expect(within(tasks).getAllByText(/Head of Claims · /)).toHaveLength(2);
  });
});
