import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createAppStore } from './store';
import { signedInSession, signedOutSession } from '../test/fixtures';
import { LocationProbe, renderWithProviders } from '../test/render';
import { RouteGuard } from './RouteGuard';

const routes = [{ path: '/signin', element: <LocationProbe label="sign-in page" /> }];

describe('RouteGuard', () => {
  it('shows the loading screen while the session is being established', () => {
    renderWithProviders(
      <RouteGuard>
        <p>secret</p>
      </RouteGuard>,
      { store: createAppStore(), routes },
    );

    expect(screen.getByRole('status')).toHaveTextContent('Signing you in');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('sends a signed-out user to sign-in', () => {
    renderWithProviders(
      <RouteGuard>
        <p>secret</p>
      </RouteGuard>,
      { state: { session: signedOutSession() }, route: '/claims', path: '/claims', routes },
    );

    expect(screen.getByTestId('location-probe')).toHaveTextContent('sign-in page');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders the page for a signed-in user', () => {
    renderWithProviders(
      <RouteGuard>
        <p>secret</p>
      </RouteGuard>,
      { state: { session: signedInSession() }, routes },
    );

    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
