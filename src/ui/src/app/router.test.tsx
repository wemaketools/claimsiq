import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createMockTransport } from '../api/mockTransport';
import { signedInSession } from '../test/fixtures';
import { renderRouteTree } from '../test/render';
import { restoreAfterEach } from '../test/restoreAfterEach';
import { features } from './featureRegistry';
import { buildRoutes } from './router';
import { configureScreenLoader } from './screenStatus';
import { signedOut } from './slices/session';
import { createAppStore } from './store';

const PAGES = [
  ['Overview', 'Paid to date'],
  ['Stages & Aging', 'Age detail'],
  ['Exceptions & SLA', 'No exceptions to review'],
  ['Claims', 'CLM-101'],
  ['Suppliers', 'No suppliers to show'],
  ['Action Queue', 'No actions in the queue'],
] as const;

describe('the application routes', () => {
  it('lands a signed-in user on Overview and walks the six pages through the sidebar, then an unknown address', async () => {
    expect(() => buildRoutes([])).toThrow('No navigation destination is registered');
    const { router } = renderRouteTree(buildRoutes(features), {
      state: { session: signedInSession(), dataContext: { dataSet: 'TEST', asOf: '2026-10-21' } },
      transport: createMockTransport(),
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/overview');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(PAGES.map(([title]) => title));
    for (const [title, empty] of PAGES) {
      await userEvent.click(within(nav).getByRole('link', { name: title }));

      expect(await screen.findByText(empty)).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      expect(within(nav).getByRole('link', { name: title })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }

    await act(() => router.navigate('/nowhere'));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('shows the loading screen while the session is established, then sends a signed-out user to sign-in', async () => {
    const store = createAppStore();
    const { router } = renderRouteTree(buildRoutes(features), { store, route: '/claims' });
    expect(screen.getByRole('status')).toHaveTextContent('Signing you in');

    act(() => {
      store.dispatch(signedOut());
    });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/signin');
  });

  it('shows a page loading, then its error with a retry that recovers to the empty state', async () => {
    let attempt = 0;
    let release: () => void = () => undefined;
    restoreAfterEach(
      configureScreenLoader(() => {
        attempt += 1;
        if (attempt === 1) {
          return new Promise<void>((resolve) => {
            release = resolve;
          }).then(() => Promise.reject(new Error('Backend is down')));
        }
        return Promise.resolve();
      }),
    );
    renderRouteTree(buildRoutes(features), {
      state: { session: signedInSession() },
      route: '/suppliers',
    });
    expect(await screen.findByText('Loading…')).toBeInTheDocument();

    await act(async () => release());

    expect(await screen.findByText('This could not be loaded')).toBeInTheDocument();
    expect(screen.getByText(/could not be reached/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No suppliers to show')).toBeInTheDocument();
  });
});
