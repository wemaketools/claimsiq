import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { ApiTransport } from '../../api/client';
import { createMockTransport } from '../../api/mockTransport';
import { captureDownloads, parseCsv } from '../../test/csv';
import { renderApp, tableRows } from '../../test/renderApp';

const NAME = 'Action Queue';
const queue = () => tableRows(NAME).map((row) => row[0]?.replace(/^(CLM-\d+)(TASK-\d+)$/, '$2 $1'));
const user = userEvent.setup();

async function createTask(
  dialogName: string,
  fields: { owner?: string; priority?: string; due?: string; note: string; claim?: string },
) {
  const dialog = await screen.findByRole('dialog', { name: dialogName });
  const create = within(dialog).getByRole('button', { name: 'Create task' });
  expect(create).toBeDisabled();
  if (fields.claim !== undefined) {
    expect(within(dialog).getByRole('combobox', { name: /^Claim/ })).toBeInTheDocument();
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: /^Claim/ }),
      fields.claim,
    );
  }
  if (fields.owner !== undefined) {
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Assign to' }),
      fields.owner,
    );
  }
  if (fields.priority !== undefined) {
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Priority' }),
      fields.priority,
    );
  }
  if (fields.due !== undefined)
    await user.type(within(dialog).getByLabelText('Due date'), fields.due);
  await user.type(within(dialog).getByRole('textbox', { name: /Next action/ }), fields.note);
  await user.click(create);
}

const rowOf = (task: string): HTMLElement =>
  screen.getByText(task, { selector: '.ciq-cell-sub' }).closest('tr') as HTMLElement;

async function pickFromRowMenu(task: string, item: string) {
  await user.click(within(rowOf(task)).getByRole('button', { name: `Actions for ${task}` }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

describe('Action Queue', () => {
  it('creates tasks from an exception and from the queue, assigns an owner, moves a task through its statuses with every change logged, sorts overdue first, filters, exports what is on screen, and keeps the tasks across a refresh until Reset', async () => {
    const downloads = captureDownloads();
    const transport = createMockTransport();
    const view = renderApp('/exceptions', { transport });

    // From an exception: CLM-106 is flagged, so the next action is asked for and the priority starts from its severity.
    await screen.findByRole('table', { name: 'Exceptions' });
    await user.click(
      await screen.findByRole('button', { name: 'Create follow-up task for CLM-106' }),
    );
    await createTask('Create a follow-up task', {
      owner: 'Mpho Demo',
      priority: 'Medium',
      due: '2026-10-19',
      note: 'Chase the repair estimate',
    });
    expect(await screen.findByText('Task TASK-0001 created for CLM-106.')).toBeInTheDocument();

    // The empty queue-to-be: Action Queue is in the sidebar and lists the task.
    await user.click(screen.getByRole('link', { name: 'Action Queue' }));
    await screen.findByRole('table', { name: NAME });
    await waitFor(() => expect(queue()).toEqual(['TASK-0001 CLM-106']));

    // From the queue itself the claim is chosen in the dialog. By hand, with the as-of date at 21 Oct: TASK-0001 was due 19 Oct,
    // so it is overdue; TASK-0002 (High, due 30 Oct) and TASK-0003 (Medium, due 25 Oct) are not; TASK-0004 has no due date.
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    await createTask('Create a follow-up task', {
      claim: 'CLM-105',
      priority: 'High',
      due: '2026-10-30',
      note: 'Confirm the triage outcome',
    });
    await user.click(await screen.findByRole('button', { name: 'Create task' }));
    await createTask('Create a follow-up task', {
      claim: 'CLM-101',
      due: '2026-10-25',
      note: 'Explain the reserve move',
    });
    await user.click(await screen.findByRole('button', { name: 'Create task' }));
    await createTask('Create a follow-up task', {
      claim: 'CLM-102',
      priority: 'Low',
      note: 'Review the triage backlog',
    });
    await waitFor(() => expect(queue()).toHaveLength(4));

    // Default order: overdue first, then priority, then due date. Columns: claim, issue, owner, due, priority, status, updated, notes.
    expect(queue()).toEqual([
      'TASK-0001 CLM-106',
      'TASK-0002 CLM-105',
      'TASK-0003 CLM-101',
      'TASK-0004 CLM-102',
    ]);
    const cells = (task: string) =>
      within(rowOf(task))
        .getAllByRole('cell')
        .map((cell) => cell.textContent ?? '');
    expect(cells('TASK-0001').slice(2, 7)).toEqual([
      'Mpho Demo',
      '19 Oct 2026Overdue',
      'Medium',
      'Open',
      expect.stringMatching(/^\d{1,2} \w{3} \d{4}, \d\d:\d\d$/),
    ]);
    expect(cells('TASK-0001')[7]).toBe('Chase the repair estimate');
    expect(cells('TASK-0001')[1]).toContain('Supplier delay');
    expect(cells('TASK-0002').slice(2, 7)).toEqual([
      'Not assigned',
      '30 Oct 2026',
      'High',
      'Open',
      expect.any(String),
    ]);
    expect(cells('TASK-0004')[3]).toBe('No due date');
    expect(
      screen.getByText('4 tasks: 1 overdue, 4 open, 0 in progress, 0 done.'),
    ).toBeInTheDocument();

    // Assign an owner from the row menu; the dialog names who acts and keeps Assign off until an owner is chosen.
    await pickFromRowMenu('TASK-0002', 'Assign owner');
    const assign = await screen.findByRole('dialog', { name: 'Assign an owner' });
    expect(within(assign).getByText('Head of Claims')).toBeInTheDocument();
    expect(within(assign).getByRole('button', { name: 'Assign' })).toBeDisabled();
    await user.selectOptions(
      within(assign).getByRole('combobox', { name: /^Owner/ }),
      'Boitumelo Demo',
    );
    await user.click(within(assign).getByRole('button', { name: 'Assign' }));
    expect(
      await screen.findByText('Task TASK-0002 assigned to Boitumelo Demo.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(cells('TASK-0002')[2]).toBe('Boitumelo Demo'));

    // Status: Open to In progress as the Head of Claims, then Done as a Claims Handler, with a note. A Done task offers only Open.
    const changeStatus = async (task: string, status: string, note?: string) => {
      await pickFromRowMenu(task, 'Change status');
      const dialog = await screen.findByRole('dialog', { name: 'Change the status' });
      await user.selectOptions(
        within(dialog).getByRole('combobox', { name: /^New status/ }),
        status,
      );
      if (note !== undefined)
        await user.type(within(dialog).getByRole('textbox', { name: /^Note/ }), note);
      await user.click(within(dialog).getByRole('button', { name: 'Change status' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    };
    await changeStatus('TASK-0001', 'In progress');
    await waitFor(() => expect(cells('TASK-0001')[5]).toBe('In progress'));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Viewing as' }),
      'claims-handler',
    );
    await changeStatus('TASK-0001', 'Done', 'Estimate received');
    await waitFor(() => expect(cells('TASK-0001')[5]).toBe('Done'));
    await pickFromRowMenu('TASK-0001', 'Change status');
    const reopen = await screen.findByRole('dialog', { name: 'Change the status' });
    expect(
      within(reopen)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Choose a status', 'Open']);
    await user.click(within(reopen).getByRole('button', { name: 'Cancel' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Viewing as' }),
      'head-of-claims',
    );

    // Done is never overdue, so TASK-0001 drops its flag and takes its place by priority and due date: it is Medium, due 19 Oct.
    expect(queue()).toEqual([
      'TASK-0002 CLM-105',
      'TASK-0001 CLM-106',
      'TASK-0003 CLM-101',
      'TASK-0004 CLM-102',
    ]);
    expect(cells('TASK-0001')[3]).toBe('19 Oct 2026');
    expect(
      screen.getByText('4 tasks: 0 overdue, 3 open, 0 in progress, 1 done.'),
    ).toBeInTheDocument();

    // The audit trail: who (the persona acting), what and when, in order.
    await user.click(
      within(rowOf('TASK-0001')).getByRole('button', { name: 'History of TASK-0001' }),
    );
    const history = await screen.findByRole('dialog', { name: 'Task TASK-0001' });
    const trail = within(within(history).getByRole('list', { name: 'History of TASK-0001' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(trail).toEqual([
      expect.stringMatching(/^Created as OpenHead of Claims · \d/),
      expect.stringMatching(/^Status changed from Open to In progressHead of Claims · \d/),
      expect.stringMatching(
        /^Status changed from In progress to DoneClaims Handler · \d.*Note: Estimate received$/,
      ),
    ]);
    await user.click(within(history).getByRole('button', { name: 'Close' }));

    // Sorting by a column keeps the queue order for ties; no due date sorts last, and the second click reverses.
    await user.click(screen.getByRole('button', { name: /^Due/ }));
    expect(queue()).toEqual([
      'TASK-0001 CLM-106',
      'TASK-0003 CLM-101',
      'TASK-0002 CLM-105',
      'TASK-0004 CLM-102',
    ]);
    await user.click(screen.getByRole('button', { name: /^Due/ }));
    expect(queue()).toEqual([
      'TASK-0004 CLM-102',
      'TASK-0002 CLM-105',
      'TASK-0003 CLM-101',
      'TASK-0001 CLM-106',
    ]);

    // Filters: status, owner and priority narrow the queue (the chosen order stays), and Clear filters also puts the order back.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Done');
    expect(queue()).toEqual(['TASK-0001 CLM-106']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Open');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Owner' }), 'Not assigned');
    expect(queue()).toEqual(['TASK-0004 CLM-102', 'TASK-0003 CLM-101']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'High');
    expect(await screen.findByText('No tasks match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(queue()).toEqual([
      'TASK-0002 CLM-105',
      'TASK-0001 CLM-106',
      'TASK-0003 CLM-101',
      'TASK-0004 CLM-102',
    ]);

    // CLM-AT-14: the file is the queue as shown, task for task.
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const file = await downloads.next();
    expect(file.name).toBe('claimsiq-actions-TEST-2026-10-21.csv');
    const csv = parseCsv(file.text);
    expect(csv[0]).toEqual([
      'Task ID',
      'Claim ID',
      'Issue',
      'Owner',
      'Due',
      'Overdue',
      'Priority',
      'Status',
      'Updated',
      'Notes',
    ]);
    expect(csv.slice(1).map((row) => row[0])).toEqual([
      'TASK-0002',
      'TASK-0001',
      'TASK-0003',
      'TASK-0004',
    ]);
    for (const row of csv.slice(1)) {
      const shown = cells(row[0] ?? '');
      expect(row[1]).toBe(shown[0]?.slice(0, 7));
      expect(row[3] === '' ? 'Not assigned' : row[3]).toBe(shown[2]);
      expect(`${row[4] === '' ? 'No due date' : row[4]}${row[5] === 'Yes' ? 'Overdue' : ''}`).toBe(
        shown[3],
      );
      expect([row[6], row[7], row[8], row[9]]).toEqual([shown[4], shown[5], shown[6], shown[7]]);
    }

    // The claim flags only add the Issue column. With that read failing the queue still lists the tasks, shows a dash for
    // the issue, says so, and exports (an empty issue cell).
    view.unmount();
    const mock = createMockTransport();
    const factsDown: ApiTransport = (url, init) =>
      url.startsWith('/api/v1/claim-facts')
        ? Promise.resolve(
            new Response(JSON.stringify({ type: 'about:blank', title: 'Down', status: 500 }), {
              status: 500,
              headers: { 'content-type': 'application/problem+json' },
            }),
          )
        : mock(url, init);
    const degraded = renderApp('/actions', { transport: factsDown });
    expect(await screen.findByText('The claim flags could not be loaded')).toBeInTheDocument();
    await waitFor(() => expect(queue()).toHaveLength(4));
    expect(cells('TASK-0001')[1]).toBe('—');
    const exportButton = screen.getByRole('button', { name: 'Export CSV' });
    await waitFor(() => expect(exportButton).toBeEnabled());
    await user.click(exportButton);
    const degradedCsv = parseCsv((await downloads.next()).text);
    expect(degradedCsv.slice(1).map((row) => row[2])).toEqual(['', '', '', '']);
    degraded.unmount();

    // A task whose claim is not among the facts (CLM-105 was reported on 20 Oct) has an unknown issue, not "Not flagged".
    const early = renderApp('/actions', { asOf: '2026-10-05' });
    await waitFor(() => expect(queue()).toHaveLength(4));
    await waitFor(() => expect(cells('TASK-0001')[1]).toContain('High value'));
    expect(cells('TASK-0002')[1]).toBe('—');
    early.unmount();

    // A refresh keeps the tasks and their trail, and Claim Detail shows the same task.
    renderApp('/actions', { transport: createMockTransport() });
    await screen.findByRole('table', { name: NAME });
    await waitFor(() =>
      expect(queue()).toEqual([
        'TASK-0002 CLM-105',
        'TASK-0001 CLM-106',
        'TASK-0003 CLM-101',
        'TASK-0004 CLM-102',
      ]),
    );
    expect(cells('TASK-0001')[5]).toBe('Done');
    await user.click(screen.getByRole('link', { name: 'CLM-106' }));
    const card = (await screen.findByRole('heading', { name: 'Follow-up tasks' })).closest(
      'section',
    ) as HTMLElement;
    expect(await within(card).findByText('TASK-0001')).toBeInTheDocument();
    expect(within(card).getByText('Note: Estimate received')).toBeInTheDocument();
    expect(within(card).getByText(/Claims Handler · /)).toBeInTheDocument();
    expect(within(card).queryByText('Overdue')).not.toBeInTheDocument();
    // The task can be moved on from the claim too, and reopened it is overdue there as in the queue.
    await user.click(within(card).getByRole('button', { name: 'Change status of TASK-0001' }));
    const dialog = await screen.findByRole('dialog', { name: 'Change the status' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /^New status/ }), 'Open');
    await user.click(within(dialog).getByRole('button', { name: 'Change status' }));
    await waitFor(() =>
      expect(within(card).getByText('Open', { selector: '.ciq-chip' })).toBeInTheDocument(),
    );
    await waitFor(() => expect(within(card).getByText('Overdue')).toBeInTheDocument());
    await user.click(screen.getByRole('link', { name: 'Action Queue' }));
    await waitFor(() => expect(cells('TASK-0001')[5]).toBe('Open'));
    expect(cells('TASK-0001')[3]).toBe('19 Oct 2026Overdue');

    // Reset throws the tasks away: the queue is empty again and says so.
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset' }),
    );
    expect(await screen.findByText('No actions in the queue')).toBeInTheDocument();
    expect(screen.queryByText('TASK-0001')).not.toBeInTheDocument();
  });
});
