import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ApiTransport } from '../../api/client';
import { createMockTransport } from '../../api/mockTransport';
import { renderApp, tableRows } from '../../test/renderApp';

const card = (name: string) => screen.getByRole('region', { name });
const cleaned = (text: string[] | undefined) => (text ?? []).map((cell) => cell.trim());

const HEADLINE = [
  'Open claims',
  'Closed claims',
  'Paid to date',
  'Outstanding reserve',
  'Incurred',
  'SLA breaches',
  'High-value claims',
  'New claims',
  'Paid in period',
  'Average closed turnaround',
  'High-priority exceptions',
];

/** Creates a task as the API would, so the digest and the Action Queue have something to show. */
async function createTask(
  transport: ApiTransport,
  claim: string,
  due: string,
  priority: 'LOW' | 'MEDIUM' | 'HIGH',
  key: string,
) {
  const response = await transport('/api/v1/tasks', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Tenant-Id': 'TEST',
      'X-As-Of': '2026-10-21',
      'X-Persona': 'head-of-claims',
      'Idempotency-Key': key,
    },
    body: JSON.stringify({
      subject_type: 'CLAIM',
      subject_id: claim,
      due_at: due,
      priority,
      note: `Follow up ${claim}`,
    }),
  });
  expect(response.status).toBe(201);
}

function failing(path: string, status: number): ApiTransport {
  const mock = createMockTransport();
  return (url, init) =>
    url.startsWith(path)
      ? Promise.resolve(
          new Response(JSON.stringify({ type: 'about:blank', title: 'Down', status }), {
            status,
            headers: { 'content-type': 'application/problem+json' },
          }),
        )
      : mock(url, init);
}

describe('Digest', () => {
  it('shows the same figures as the Overview, Exceptions, Claim Detail, Suppliers and Action Queue screens, five rows at most per table, with the data set and as-of date in its header', async () => {
    const user = userEvent.setup();
    const transport = createMockTransport();
    for (const [index, claim] of [
      'CLM-101',
      'CLM-102',
      'CLM-104',
      'CLM-105',
      'CLM-106',
      'CLM-101',
    ].entries()) {
      await createTask(
        transport,
        claim,
        `2026-10-${15 + index * 2}`,
        index % 2 === 0 ? 'HIGH' : 'LOW',
        `k-${index}`,
      );
    }
    renderApp('/digest', { transport });
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    // The header names what the page is about, so a printout is self-explaining.
    await screen.findByRole('region', { name: 'Open claims' });
    const sheet = screen.getByRole('article', { name: 'Claims digest' });
    expect(sheet).toHaveTextContent('Data setTEST');
    expect(sheet).toHaveTextContent('As of21 Oct 2026');
    expect(sheet).toHaveTextContent('FiltersNone, all claims');
    expect(sheet).not.toHaveTextContent(/fraud/i);

    // Headline figures: every card, hint included.
    await waitFor(() =>
      expect(screen.getByRole('table', { name: 'Open actions' })).not.toHaveAttribute(
        'aria-busy',
        'true',
      ),
    );
    const headline = Object.fromEntries(HEADLINE.map((label) => [label, card(label).textContent]));
    expect(headline['Paid to date']).toContain('P9,000.00');
    expect(headline['SLA breaches']).toContain('3');

    // The tables as the digest shows them.
    await screen.findByRole('table', { name: 'Top exceptions' });
    const exceptions = tableRows('Top exceptions').map(cleaned);
    const exceptionsSentence = screen.getByText(/claims need review/).textContent;
    const reserve = tableRows('Material reserve movements').map(cleaned);
    const suppliers = tableRows('Supplier delays').map(cleaned);
    const baseline = screen.getByText(/open waits together/).textContent;
    const actions = tableRows('Open actions').map(cleaned);
    expect(exceptions.map((row) => row[0])).toEqual(['CLM-102', 'CLM-106', 'CLM-101', 'CLM-105']);
    expect(reserve).toEqual([
      [
        'CLM-101',
        '2026-10-16',
        'P8,000.00',
        'P11,000.00',
        'Up P3,000.0037.5% of the earlier amount',
        'at least 30% of the earlier amount',
      ],
    ]);
    expect(actions).toHaveLength(5);
    expect(screen.getByText('Showing 5 of 6.')).toBeInTheDocument();
    expect(screen.getByText('6 open actions, 3 overdue.')).toBeInTheDocument();

    // Overview: the same cards.
    await user.click(within(nav).getByRole('link', { name: 'Overview' }));
    await screen.findByRole('region', { name: 'Open claims' });
    for (const label of HEADLINE) expect(card(label).textContent, label).toBe(headline[label]);

    // Exceptions: the same claims in the same order with the same facts, and the same sentence.
    await user.click(within(nav).getByRole('link', { name: 'Exceptions & SLA' }));
    await screen.findByRole('table', { name: 'Exceptions' });
    expect(screen.getByText(/claims need review/).textContent).toBe(exceptionsSentence);
    const screenExceptions = tableRows('Exceptions').map(cleaned);
    expect(screenExceptions.map((row) => [row[0], row[1], row[3], row[4], row[5], row[6]])).toEqual(
      exceptions.map((row) => [row[0], row[1], row[3], row[4], row[5], row[6]]),
    );
    screenExceptions.forEach((row, index) => {
      for (const label of (exceptions[index]?.[2] ?? '').split(', '))
        expect(row[2]).toContain(label);
    });

    // Claim Detail: the reserve movement is the one on the claim, marked material for the same reason.
    await user.click(within(nav).getByRole('link', { name: 'Claims' }));
    const claimsTable = await screen.findByRole('table', { name: 'Claims' });
    await waitFor(() => expect(claimsTable).not.toHaveAttribute('aria-busy', 'true'));
    await user.click(await within(claimsTable).findByRole('link', { name: 'CLM-101' }));
    await screen.findByRole('table', { name: 'Reserve history of the claim' });
    const history = tableRows('Reserve history of the claim').map(cleaned);
    const movement = history.find((row) => row[0]?.includes('16 Oct 2026'));
    expect(movement?.slice(1, 3)).toEqual(['P8,000.00', 'P11,000.00']);
    expect(movement?.join(' ')).toContain('+P3,000.00');
    expect(movement?.join(' ')).toContain('at least 30% of the earlier amount');

    // Suppliers: the same delayed supplier and baseline.
    await user.click(within(nav).getByRole('link', { name: 'Suppliers' }));
    await screen.findByRole('table', { name: 'Wait percentiles by supplier' });
    const supplierRow = tableRows('Suppliers')
      .map(cleaned)
      .find((row) => row[0]?.startsWith('Mma-Motor'));
    const digestSupplier = suppliers[0] ?? [];
    expect([digestSupplier[1], digestSupplier[2], digestSupplier[3]]).toEqual([
      supplierRow?.[1],
      supplierRow?.[4],
      supplierRow?.[3],
    ]);
    const percentiles = tableRows('Wait percentiles by supplier').map(cleaned);
    const own = percentiles.find((row) => row[0]?.startsWith('Mma-Motor'));
    expect([digestSupplier[4], digestSupplier[5]]).toEqual([own?.[2], own?.[3]]);
    const all = percentiles.find((row) => row[0]?.startsWith('All suppliers'));
    expect(baseline).toContain(`${all?.[1]} requests`);

    // Action Queue: the first five open actions, in the queue's own order.
    await user.click(within(nav).getByRole('link', { name: 'Action Queue' }));
    await screen.findByRole('table', { name: 'Action Queue' });
    const queue = tableRows('Action Queue').map(cleaned);
    expect(queue).toHaveLength(6);
    expect(actions.map((row) => row[1])).toEqual(
      queue.slice(0, 5).map((row) => row[0]?.slice(0, 7)),
    );
    expect(actions.map((row) => row[3])).toEqual(queue.slice(0, 5).map((row) => row[3]));
  });

  it('follows the shared filters and the as-of date, says so in its header, and shows an empty state when no claim is in view', async () => {
    const user = userEvent.setup();
    const transport = createMockTransport();
    await createTask(transport, 'CLM-101', '2026-10-19', 'HIGH', 'a');
    await createTask(transport, 'CLM-102', '2026-10-19', 'HIGH', 'b');
    renderApp('/digest', { transport });
    await screen.findByText('2 open actions, 2 overdue.');

    await user.selectOptions(screen.getByLabelText('Broker'), 'Kopano Brokers (fictional)');
    await waitFor(() => expect(card('Open claims')).toHaveTextContent('2'));
    const sheet = screen.getByRole('article', { name: 'Claims digest' });
    expect(sheet).toHaveTextContent('FiltersBroker: Kopano Brokers (fictional)');
    expect(card('Incurred')).toHaveTextContent('P20,000.00');
    const shown = tableRows('Top exceptions').map((row) => row[0]);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown).not.toContain('CLM-104');
    await waitFor(() =>
      expect(screen.getByText(/open actions?, /).textContent).toMatch(/^\d open action/),
    );
    const taskClaims = tableRows('Open actions').map((row) => row[1]);
    expect(taskClaims.every((claim) => ['CLM-101', 'CLM-102'].includes(claim ?? ''))).toBe(true);
    expect(screen.getByText(/Only tasks on the claims in view/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('As of'), { target: { value: '2026-10-05' } });
    await waitFor(() => expect(sheet).toHaveTextContent('As of5 Oct 2026'));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(card('Open claims')).toHaveTextContent('3'));

    fireEvent.change(screen.getByLabelText('As of'), { target: { value: '2026-01-01' } });
    expect(await screen.findByText('No claims to summarize')).toBeInTheDocument();
    expect(screen.getByLabelText('Broker')).toBeInTheDocument();
  });

  it('prints through the browser, names a failed section with a retry while the others stay, and shows the restricted state instead of figures when the claims are refused', async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const failed = renderApp('/digest', { transport: failing('/api/v1/supplier-insights', 500) });
    await screen.findByRole('region', { name: 'Open claims' });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Top exceptions' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Print or save as PDF' }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
    failed.unmount();

    renderApp('/digest', { transport: failing('/api/v1/claim-facts', 403) });
    expect(await screen.findByText('Restricted')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Open claims' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print or save as PDF' })).toBeDisabled();
  });
});
