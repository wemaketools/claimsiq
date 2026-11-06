import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { endpoints } from '../../../../contracts/index';
import { call } from '../../api/client';
import { invalidateApiQueries } from '../../api/hooks';
import { fixtureFiles, transportOver } from '../../test/datasets';
import { renderApp, tableRows } from '../../test/renderApp';

/** The card with this heading. */
const card = (heading: string): HTMLElement =>
  screen.getByRole('heading', { name: heading }).closest('section') as HTMLElement;

const history = (claim: string) =>
  within(screen.getByRole('list', { name: `Stage history of ${claim}` }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');

describe('Claim Detail', () => {
  it('shows the golden claims as the spec expects: the evidence behind a high-value supplier delay, a reserve move with before and after, an approved claim that is not paid, a closed claim that was, and a claim that is not visible yet', async () => {
    const { router } = renderApp('/claims/CLM-106');

    // CLM-AT-07/08: high value, waiting on a supplier, with the request time and the target in view.
    expect(
      await screen.findByRole('heading', { name: 'Claim CLM-106', level: 1 }),
    ).toBeInTheDocument();
    const claim = (
      await screen.findByRole('heading', { name: 'Claim, policy and client' })
    ).closest('section') as HTMLElement;
    for (const text of [
      'CLM-106',
      'SYN-BW-00006',
      'POL-006',
      'Naledi Engineering (fictional)',
      'CLI-006',
      'Property All Risk',
      'PRD-02',
      'Direct Sales',
      '25 Sep 2026',
      'Boitumelo Demo',
      'USR-CLM',
      'Mma-Motor Repairs (fictional)',
      'SUP-02',
    ]) {
      expect(claim).toHaveTextContent(text);
    }
    const flag = card('Why this claim is flagged');
    expect(flag).toHaveTextContent('High');
    expect(flag).toHaveTextContent('High value and delayed');
    expect(flag).toHaveTextContent(
      'Incurred P30,000.00 is at or above the P25,000.00 high-value line',
    );
    expect(flag).toHaveTextContent('Assessment: 10 business days over a 5-day target');
    expect(tableRows('Supplier requests of the claim')).toEqual([
      [
        'Repair estimateREQ-CLM-106',
        'Mma-Motor Repairs (fictional)SUP-02',
        '2 Oct 2026',
        'Pending',
        '13 of 5 business days (8 over)',
        'Delayed',
      ],
    ]);

    // Paid, reserve and incurred are three figures that add up, and the stage timeline is oldest first.
    const money = card('Paid, reserve and incurred');
    expect(money).toHaveTextContent('Paid to dateP0.00');
    expect(money).toHaveTextContent('Outstanding reserveP30,000.00');
    expect(money).toHaveTextContent('IncurredP30,000.00');
    expect(money).toHaveTextContent('P0.00 paid + P30,000.00 reserve = P30,000.00 incurred');
    expect(history('CLM-106')).toEqual([
      expect.stringContaining('Entered New'),
      expect.stringMatching(/New → Assessment.*Current stage/),
    ]);
    expect(card('Stage timeline')).toHaveTextContent(
      'The recorded stage Assessment matches the event history.',
    );
    expect(screen.getByRole('link', { name: 'View policy invoices' })).toHaveAttribute(
      'href',
      '/policies/POL-006/invoices?claim=CLM-106',
    );

    // CLM-AT-06: the reserve moved P8,000 to P11,000, shown old to new with the rule that flagged it, and no verdict.
    await act(() => router.navigate('/claims/CLM-101'));
    await screen.findByRole('heading', { name: 'Claim CLM-101', level: 1 });
    await waitFor(() =>
      expect(tableRows('Reserve history of the claim')).toEqual([
        ['1 Oct 2026', 'P0.00', 'P8,000.00', '—', 'Opening reserve', 'Initial open reserve'],
        [
          '16 Oct 2026',
          'P8,000.00',
          'P11,000.00',
          '+P3,000.0037.5%',
          'Review: material changeat least 30% of the earlier amount',
          'Additional repair scope',
        ],
      ]),
    );
    expect(card('Reserve history')).toHaveTextContent('It is not a finding');
    expect(card('Why this claim is flagged')).toHaveTextContent('Material reserve change');
    expect(document.body.textContent).not.toMatch(/leakage|fraud/i);

    // CLM-AT-04: approved is not paid.
    await act(() => router.navigate('/claims/CLM-104'));
    await screen.findByRole('heading', { name: 'Claim CLM-104', level: 1 });
    expect(await screen.findByText('Approved is not paid')).toBeInTheDocument();
    expect(card('Paid, reserve and incurred')).toHaveTextContent('Paid to dateP0.00');
    expect(card('Paid, reserve and incurred')).toHaveTextContent('Outstanding reserveP9,000.00');
    expect(card('Payments')).toHaveTextContent(
      'No posted payment: nothing has been paid on this claim.',
    );
    expect(card('Why this claim is flagged')).toHaveTextContent('No review indicator is set');

    // CLM-AT-05: a closed claim shows its posted payment, no clock and no review indicator.
    await act(() => router.navigate('/claims/CLM-103'));
    await screen.findByRole('heading', { name: 'Claim CLM-103', level: 1 });
    await waitFor(() =>
      expect(tableRows('Posted payments of the claim')).toEqual([
        ['13 Oct 2026', 'SYN-PAY-CLM-103', 'P4,000.00', 'Posted'],
      ]),
    );
    expect(card('Paid, reserve and incurred')).toHaveTextContent('Paid to dateP4,000.00');
    expect(card('Paid, reserve and incurred')).toHaveTextContent('Outstanding reserveP0.00');
    expect(card('Why this claim is flagged')).toHaveTextContent('The claim is closed');
    expect(screen.queryByText('Approved is not paid')).not.toBeInTheDocument();

    // A claim not reported yet at the as-of date, or not in the data set, is said so and leads back to the list.
    await act(() => router.navigate('/claims/CLM-106'));
    await screen.findByRole('heading', { name: 'Claim CLM-106', level: 1 });
    fireEvent.change(screen.getByLabelText('As of'), { target: { value: '2026-09-20' } });
    expect(await screen.findByText('Claim not visible')).toBeInTheDocument();
    expect(screen.getByText(/No claim CLM-106 is reported as of 20 Sep 2026/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to claims' })).toHaveAttribute('href', '/claims');
    await act(() => router.navigate('/claims/CLM-999'));
    expect(await screen.findByText(/No claim CLM-999 is reported/)).toBeInTheDocument();
  });

  it('shows missing evidence as unknown and records what is not posted, what differs and what a task changed', async () => {
    const files = fixtureFiles('test');
    const transport = transportOver({
      TEST: {
        ...files,
        // CLM-105's only stage event has no time; CLM-102's recorded stage no longer matches its events;
        // REQ-CLM-101 has no request time.
        'claim_events.csv': (files['claim_events.csv'] ?? '').replace(
          'EVT-CLM-105-1,CLM-105,2026-10-20,',
          'EVT-CLM-105-1,CLM-105,,',
        ),
        'claims.csv': (files['claims.csv'] ?? '').replace(
          'POL-002,2026-09-01,2026-09-01,Triage',
          'POL-002,2026-09-01,2026-09-01,Assessment',
        ),
        'supplier_requests.csv': (files['supplier_requests.csv'] ?? '').replace(
          'REQ-CLM-101,CLM-101,SUP-02,2026-10-06',
          'REQ-CLM-101,CLM-101,SUP-02,',
        ),
        // CLM-104 has a pending, a void and a rejected payment next to its posted one.
        'claim_payments.csv': `${files['claim_payments.csv'] ?? ''}TEST,CPAY-X1,CLM-104,2026-10-20,1000,BWP,SYN-PAY-X1,PENDING\nTEST,CPAY-X2,CLM-104,2026-10-19,2000,BWP,SYN-PAY-X2,VOID\nTEST,CPAY-X3,CLM-104,2026-10-18,500,BWP,SYN-PAY-X3,REJECTED\nTEST,CPAY-X4,CLM-104,2026-10-17,700,BWP,SYN-PAY-X4,POSTED\n`,
      },
    });
    const { router } = renderApp('/claims/CLM-105', { transport });

    // CLM-AT-09: a claim with no stage time is "SLA unknown", never within target.
    await screen.findByRole('heading', { name: 'Claim CLM-105', level: 1 });
    expect(
      await screen.findByText('SLA unknown', { selector: '.ciq-banner-title' }),
    ).toBeInTheDocument();
    expect(card('Why this claim is flagged')).toHaveTextContent(
      'New: no dated stage event, so the stage clock cannot start',
    );
    expect(card('Stage timeline')).toHaveTextContent(
      'No time recorded: this event cannot be placed in order.',
    );
    expect(card('Stage timeline')).toHaveTextContent(
      'Not compared: no dated stage event to compare with.',
    );
    expect(screen.queryByText('Within target')).not.toBeInTheDocument();

    // A recorded stage that differs from the events is a discrepancy alert.
    await act(() => router.navigate('/claims/CLM-102'));
    await screen.findByRole('heading', { name: 'Claim CLM-102', level: 1 });
    expect(
      await screen.findByText(
        'The recorded stage Assessment differs from the event history (Triage). Reconcile the record before relying on either.',
      ),
    ).toBeInTheDocument();

    // A supplier request with no request time is unverified, with its target still shown.
    await act(() => router.navigate('/claims/CLM-101'));
    await screen.findByRole('heading', { name: 'Claim CLM-101', level: 1 });
    await waitFor(() =>
      expect(tableRows('Supplier requests of the claim')[0]).toEqual([
        'Repair estimateREQ-CLM-101',
        'Mma-Motor Repairs (fictional)SUP-02',
        'Unknown',
        'Pending',
        'Unknown (no request time) · target 5',
        'Unverified',
      ]),
    );

    // CLM-AT-11: pending, void and rejected payments are listed apart and are not paid.
    await act(() => router.navigate('/claims/CLM-104'));
    await screen.findByRole('heading', { name: 'Claim CLM-104', level: 1 });
    await waitFor(() =>
      expect(tableRows('Payments that are not posted')).toEqual([
        ['18 Oct 2026', 'SYN-PAY-X3', 'P500.00', 'Rejected'],
        ['19 Oct 2026', 'SYN-PAY-X2', 'P2,000.00', 'Void'],
        ['20 Oct 2026', 'SYN-PAY-X1', 'P1,000.00', 'Pending'],
      ]),
    );
    expect(tableRows('Posted payments of the claim')).toEqual([
      ['17 Oct 2026', 'SYN-PAY-X4', 'P700.00', 'Posted'],
    ]);
    const money = card('Paid, reserve and incurred');
    expect(money).toHaveTextContent('Paid to dateP700.00');
    expect(card('Payments')).toHaveTextContent('Posted total: P700.00');
    expect(screen.queryByText('Approved is not paid')).not.toBeInTheDocument();

    // Tasks show who changed what and when: created, assigned, then moved on.
    const task = await call(endpoints.tasksCreate, {
      body: {
        subject_type: 'CLAIM',
        subject_id: 'CLM-104',
        assigned_to: null,
        priority: 'MEDIUM',
        note: 'Confirm the payment date',
      },
    });
    await call(endpoints.tasksAssign, {
      params: { taskId: task.task_id },
      body: { assigned_to: 'USR-SUP' },
    });
    await call(endpoints.tasksSetStatus, {
      params: { taskId: task.task_id },
      body: { status: 'IN_PROGRESS' },
    });
    act(() => invalidateApiQueries('tasks.'));
    const tasks = card('Follow-up tasks');
    expect(await within(tasks).findByText('Confirm the payment date')).toBeInTheDocument();
    expect(within(tasks).getByText(/Assigned to: Mpho Demo/)).toBeInTheDocument();
    await waitFor(() => {
      const trail = within(within(tasks).getByRole('list', { name: `History of ${task.task_id}` }))
        .getAllByRole('listitem')
        .map((item) => item.textContent ?? '');
      expect(trail).toEqual([
        expect.stringContaining('Created as Open'),
        expect.stringContaining('Assigned to Mpho Demo'),
        expect.stringContaining('Status changed from Open to In progress'),
      ]);
      expect(trail.every((line) => line.includes('Head of Claims · '))).toBe(true);
    });
  });
});
