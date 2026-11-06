import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { endpoints } from '../../../../contracts/index';
import { call } from '../../api/client';
import { fixtureFiles, transportOver } from '../../test/datasets';
import { renderApp, tableRows } from '../../test/renderApp';

const INVOICES = 'Invoices of the policy';

describe('Policy invoices (the stand-in for Premium Collections)', () => {
  it('opens from a claim to the invoices of the same policy identifier only, says when a policy has none, and marks itself as a stand-in', async () => {
    const user = userEvent.setup();
    const files = fixtureFiles('test');
    const transport = transportOver({
      TEST: {
        ...files,
        // A second invoice on CLM-106's policy, with no due date and part of a receipt applied; POL-005 loses its invoice.
        'premium_invoices.csv': `${(files['premium_invoices.csv'] ?? '')
          .split('\n')
          .filter((line) => !line.includes('INV-005'))
          .join('\n')}TEST,INV-007,POL-006,2026-09-01,,3000,BWP,ISSUED\n`,
        'payment_allocations.csv': `${files['payment_allocations.csv'] ?? ''}TEST,ALLOC-X1,RCP-UNAPP,INV-007,500,2026-10-12\n`,
      },
    });
    const { router } = renderApp('/claims/CLM-106', { transport });

    // CLM-AT-15: CLM-106 to its policy to the invoices carrying that policy_id, and no other.
    await user.click(await screen.findByRole('link', { name: 'View policy invoices' }));
    expect(
      await screen.findByRole('heading', { name: 'Policy invoices', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Policy SYN-BW-00006 (POL-006)')).toBeInTheDocument();
    expect(await screen.findByText('A stand-in for Premium Collections')).toBeInTheDocument();
    expect(
      screen.getByText(/joins on the policy identifier only, never on a name/),
    ).toBeInTheDocument();
    await screen.findByRole('table', { name: INVOICES });
    expect(tableRows(INVOICES)).toEqual([
      [
        'INV-006',
        '27 May 2026',
        '1 Jun 2026',
        'P7,000.00',
        'P0.00',
        'P7,000.00',
        'Issued',
        'None allocated',
      ],
      [
        'INV-007',
        '1 Sep 2026',
        'Unknown',
        'P3,000.00',
        'P500.00',
        'P2,500.00',
        'Issued',
        'RCP-UNAPP',
      ],
    ]);
    expect(
      screen.getByText('2 invoices for P10,000.00; P500.00 allocated, P9,500.00 outstanding.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('INV-001')).not.toBeInTheDocument();
    const { items } = await call(endpoints.invoicesList, { query: { policy_id: 'POL-006' } });
    expect(items.map((invoice) => invoice.invoice_id)).toEqual(['INV-006', 'INV-007']);

    // The way back leads to the claim the user came from.
    await user.click(screen.getByRole('link', { name: 'Claim CLM-106' }));
    expect(
      await screen.findByRole('heading', { name: 'Claim CLM-106', level: 1 }),
    ).toBeInTheDocument();

    // A policy with no invoice says so, and an unknown policy is not found.
    await act(() => router.navigate('/policies/POL-005/invoices?claim=CLM-105'));
    expect(await screen.findByText('No invoice for this policy')).toBeInTheDocument();
    expect(
      screen.getByText(/No invoice with the policy identifier POL-005 exists in this data set/),
    ).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByText('INV-006')).not.toBeInTheDocument();
    await act(() => router.navigate('/policies/POL-999/invoices'));
    expect(await screen.findByText('Policy not found')).toBeInTheDocument();
  });
});
