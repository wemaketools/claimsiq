import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderApp } from '../../test/renderApp';

/** The card with this heading. */
const card = (heading: string): HTMLElement =>
  screen.getByRole('heading', { name: heading }).closest('section') as HTMLElement;

const history = (claim: string) =>
  within(screen.getByRole('list', { name: `Stage history of ${claim}` }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');

describe('Claim Detail what-if', () => {
  it('previews a stage move beside the real view without saving it, offers only legal moves, and starts clean on the next claim', async () => {
    const { router } = renderApp('/claims/CLM-102');
    await screen.findByRole('heading', { name: 'Claim CLM-102', level: 1 });

    // CLM-FR-19: a what-if move of CLM-102 to Assessment restarts its stage clock in a preview, and saves nothing.
    const whatIf = (await screen.findByRole('heading', { name: 'Stage what-if' })).closest(
      'section',
    ) as HTMLElement;
    expect(whatIf).toHaveTextContent('What-if: not saved');
    expect(within(whatIf).getByRole('button', { name: 'Reset' })).toBeDisabled();
    const pick = await within(whatIf).findByLabelText('Move the claim to');
    await waitFor(() =>
      expect(
        within(pick)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual([
        'Choose a stage',
        'Assessment',
        'Negotiation',
        'Approved',
        'Settlement',
        'Closed',
      ]),
    );
    fireEvent.change(pick, { target: { value: 'Assessment' } });
    const compared = await within(whatIf).findByRole('table', {
      name: 'Claim now and in a what-if move to Assessment',
    });
    expect(within(compared).getByText('What-if: Assessment')).toBeInTheDocument();
    const [stage, sla, severity, started] = within(compared).getAllByRole('row').slice(1);
    expect(stage).toHaveTextContent('StageTriageAssessment');
    expect(sla).toHaveTextContent(/Breached.*Triage: \d+ business days over a \d+-day target/);
    expect(sla).toHaveTextContent(/Within target.*Assessment: 0 of 5 business days used/);
    expect(severity).toHaveTextContent('Severity');
    expect(started).toHaveTextContent('3 Sep 202621 Oct 2026');
    expect(card('Stage timeline')).toHaveTextContent('Triage');
    expect(history('CLM-102')).toHaveLength(2);
    fireEvent.click(within(whatIf).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(within(whatIf).queryByRole('table')).not.toBeInTheDocument());
    expect(within(whatIf).getByLabelText('Move the claim to')).toHaveValue('');

    // A closed claim can only be reopened, which has no target: the SLA is unknown, never within.
    await act(() => router.navigate('/claims/CLM-103'));
    await screen.findByRole('heading', { name: 'Claim CLM-103', level: 1 });
    const closedWhatIf = (await screen.findByRole('heading', { name: 'Stage what-if' })).closest(
      'section',
    ) as HTMLElement;
    const reopen = await within(closedWhatIf).findByLabelText('Move the claim to');
    await waitFor(() =>
      expect(
        within(reopen)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Choose a stage', 'Reopened']),
    );
    fireEvent.change(reopen, { target: { value: 'Reopened' } });
    const reopened = await within(closedWhatIf).findByRole('table', {
      name: 'Claim now and in a what-if move to Reopened',
    });
    expect(within(reopened).getAllByRole('row')[2]).toHaveTextContent(
      'No stage clock: the claim is closed.Unknown',
    );
  });
});
