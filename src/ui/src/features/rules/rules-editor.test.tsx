import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createMockTransport } from '../../api/mockTransport';
import { captureDownloads, parseCsv } from '../../test/csv';
import { renderApp, tableRows } from '../../test/renderApp';

const AUDIT = 'History of changes to the rules';

const go = async (user: ReturnType<typeof userEvent.setup>, destination: string) =>
  user.click(
    within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', {
      name: destination,
    }),
  );

const highValueClaims = () => {
  const card = screen.getByRole('region', { name: 'High-value claims' });
  return within(card).getByText(/^\d+$/).textContent;
};

describe('Rules editor', () => {
  it('shows each value with its saved and default value, validates what is typed, saves at once for every screen and the CSV export with an audit entry, restores the spec’s rules, and stays in step with another save', async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    const transport = createMockTransport();
    renderApp('/overview', { transport });

    // The spec’s rules: CLM-106 (P30,000) is above the P25,000 line, so one claim is high value.
    await screen.findByRole('region', { name: 'High-value claims' });
    await waitFor(() => expect(highValueClaims()).toBe('1'));
    await go(user, 'Rules');
    const line = await screen.findByLabelText('High-value line');
    expect(line).toHaveValue('25000');
    expect(screen.getByText('Saved P25,000.00 · spec default P25,000.00')).toBeInTheDocument();
    expect(screen.getByLabelText('Stage target: Assessment')).toHaveValue('5');
    expect(screen.getByLabelText('Age buckets: upper limits')).toHaveValue('7, 30, 60, 90');
    expect(screen.getByText('Version 1 · the spec’s rules, never changed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restore defaults' })).toBeDisabled();
    expect(screen.getByText('No changes yet')).toBeInTheDocument();

    // A value that is not a number, and buckets that do not increase, are refused before anything is sent.
    await user.clear(line);
    expect(await screen.findByText('Enter a number.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    const buckets = screen.getByLabelText('Age buckets: upper limits');
    await user.clear(buckets);
    await user.type(buckets, '30, 7');
    expect(
      await screen.findByText('Each limit must be larger than the one before.'),
    ).toBeInTheDocument();
    await user.clear(buckets);
    await user.type(buckets, '7, 30, 60, 90');
    // What is typed stays in the field with a plain message and Save stays off, whatever the kind of mistake.
    const typed = async (label: string, text: string, message: string) => {
      const field = screen.getByLabelText(label);
      await user.clear(field);
      await user.type(field, text);
      expect(field).toHaveValue(text);
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
      expect(
        screen.queryByText(/expected|Too small|Too big|Invalid input/),
      ).not.toBeInTheDocument();
      await user.clear(field);
      await user.type(field, saved[label] ?? '');
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    };
    const saved: Record<string, string> = {
      'Supplier sample minimum': '2',
      'High-value line': '25000',
      'Approaching window': '1',
      'Stage target: New': '2',
    };
    await typed('Supplier sample minimum', '0', 'Must be at least 1.');
    await typed('High-value line', '-5', 'Must be at least 0.');
    await typed('High-value line', 'abc', 'Enter a number.');
    await typed('Approaching window', '1.5', 'Must be a whole number.');
    await typed('Stage target: New', '0x10', 'Enter a number.');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByLabelText('High-value line')).toHaveValue('25000');

    // Reset names the saved rules among what it removes.
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    const resetting = await screen.findByRole('dialog', { name: 'Reset the TEST data set?' });
    expect(
      within(resetting).getByText(/the saved rules and their change history/),
    ).toBeInTheDocument();
    await user.click(within(resetting).getByRole('button', { name: 'Cancel' }));

    // CLM-106 stops being high value at P40,000, on the Overview and in the Exceptions & SLA CSV.
    await user.clear(line);
    await user.type(line, '40000');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const confirm = await screen.findByRole('dialog', { name: 'Save the rules?' });
    expect(
      within(confirm).getByText('High-value line: P25,000.00 to P40,000.00'),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('The rules were saved (version 2).')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/^Version 2 · last saved .* by Head of Claims$/)).toBeInTheDocument(),
    );
    await waitFor(() => expect(tableRows(AUDIT)).toHaveLength(1));
    expect(tableRows(AUDIT)[0]?.slice(1)).toEqual([
      'Head of Claims',
      'High-value line',
      'P25,000.00',
      'P40,000.00',
      'Saved',
    ]);

    await go(user, 'Overview');
    await waitFor(() => expect(highValueClaims()).toBe('0'));
    await go(user, 'Exceptions & SLA');
    await screen.findByRole('table', { name: 'Exceptions' });
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    const afterSave = parseCsv((await downloads.next()).text);
    expect(afterSave.flat().join(' ')).not.toMatch(/high-value/i);

    // Restore defaults is confirmed and audited, and brings the spec’s numbers back everywhere.
    await go(user, 'Rules');
    await waitFor(() => expect(screen.getByLabelText('High-value line')).toHaveValue('40000'));
    expect(screen.getByText('Saved P40,000.00 · spec default P25,000.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore defaults' }));
    const restoring = await screen.findByRole('dialog', { name: 'Restore the spec’s rules?' });
    await user.click(within(restoring).getByRole('button', { name: 'Restore defaults' }));
    expect(await screen.findByText('The spec’s rules are back (version 3).')).toBeInTheDocument();
    await waitFor(() => expect(tableRows(AUDIT)).toHaveLength(2));
    expect(tableRows(AUDIT).map((row) => row.slice(1))).toEqual([
      ['Head of Claims', 'High-value line', 'P40,000.00', 'P25,000.00', 'Restored'],
      ['Head of Claims', 'High-value line', 'P25,000.00', 'P40,000.00', 'Saved'],
    ]);
    await waitFor(() => expect(screen.getByLabelText('High-value line')).toHaveValue('25000'));
    await go(user, 'Overview');
    await waitFor(() => expect(highValueClaims()).toBe('1'));
    await go(user, 'Exceptions & SLA');
    await screen.findByRole('table', { name: 'Exceptions' });
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(
      parseCsv((await downloads.next()).text)
        .flat()
        .join(' '),
    ).toMatch(/high-value/i);

    // Another browser tab saved first: this save is refused as stale, the page shows the latest rules and says so.
    await go(user, 'Rules');
    const stage = await screen.findByLabelText('Stage target: Assessment');
    await transport('/api/v1/rule-config', {
      method: 'POST',
      headers: { 'X-Tenant-Id': 'TEST', 'X-Persona': 'finance' },
      body: JSON.stringify({
        version: 3,
        claims: {
          stage_sla_business_days: {
            New: 2,
            Triage: 3,
            Assessment: 4,
            Negotiation: 5,
            Approved: 5,
            Settlement: 3,
          },
          supplier_wait_target_business_days: 5,
          supplier_min_sample: 2,
          material_reserve_delta_absolute_BWP: 5000,
          material_reserve_delta_percent: 30,
          high_value_incurred_BWP: 25000,
          approaching_window_business_days: 1,
          severity_high_sla_days_late: 2,
          severity_high_reserve_change_min_age_days: 30,
          age_bucket_upper_days: [7, 30, 60, 90],
        },
      }),
    });
    await user.clear(stage);
    await user.type(stage, '9');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Save the rules?' })).getByRole('button', {
        name: 'Save changes',
      }),
    );
    expect(
      await screen.findByText('The rules were saved by someone else first'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Stage target: Assessment')).toHaveValue('4'));
    expect(screen.getByText(/^Version 4 · last saved .* by Finance$/)).toBeInTheDocument();
  });

  it('shows the rules read-only, with the restricted note, to a persona that may not edit them', async () => {
    const user = userEvent.setup();
    renderApp('/rules');

    await screen.findByLabelText('High-value line');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Viewing as' }),
      'claims-handler',
    );
    await user.click(await screen.findByRole('link', { name: 'Rules' }));
    expect(await screen.findByText('Read-only for this persona')).toBeInTheDocument();
    expect(screen.getByText(/You are viewing as Claims Handler/)).toBeInTheDocument();
    expect(screen.queryByLabelText('High-value line')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    const stages = tableRows('The rules of the Stage targets group');
    expect(stages[0]).toEqual(['Stage target: New', '2 business days', '2 business days']);
    expect(tableRows('The rules of the Money thresholds group').map((row) => row[0])).toEqual([
      'Material reserve change: amountA reserve move of at least this amount is material.',
      'Material reserve change: percentA reserve move of at least this share of the earlier amount is material.',
      'High-value lineAn open claim with incurred at or above this is high value.',
    ]);
    expect(screen.getByRole('table', { name: AUDIT })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Viewing as' }), 'finance');
    await user.click(await screen.findByRole('link', { name: 'Rules' }));
    expect(await screen.findByLabelText('High-value line')).toBeInTheDocument();
    expect(screen.queryByText('Read-only for this persona')).not.toBeInTheDocument();
  });
});
