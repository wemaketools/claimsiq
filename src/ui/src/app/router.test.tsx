import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { ApiError } from '../api/client';
import { AuthContext } from '../auth/authContext';
import { ToastProvider } from '../components/ui/ToastProvider';
import { signedInSession, signedOutSession } from '../test/fixtures';
import { stubAuth } from '../test/render';
import { buildRoutes } from './router';
import { features } from './featureRegistry';
import { configureScreenLoader } from './screenStatus';
import { createAppStore } from './store';
import type { RootState } from './store';

const restores: Array<() => void> = [];
afterEach(() => {
  while (restores.length > 0) restores.pop()?.();
});

function renderApp(route: string, session: RootState['session']) {
  const router = createMemoryRouter(buildRoutes(features), { initialEntries: [route] });
  render(
    <Provider store={createAppStore({ session })}>
      <AuthContext.Provider value={stubAuth()}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthContext.Provider>
    </Provider>,
  );
  return router;
}

const PAGES = [
  ['/overview', 'Overview', 'No claims to summarize'],
  ['/stages', 'Stages & Aging', 'No claims by stage'],
  ['/exceptions', 'Exceptions & SLA', 'No exceptions to review'],
  ['/claims', 'Claims', 'No claims to list'],
  ['/suppliers', 'Suppliers', 'No suppliers to show'],
  ['/actions', 'Action Queue', 'No actions in the queue'],
] as const;

describe('the route tree', () => {
  it('cannot be built without a navigation destination, instead of redirecting in a loop', () => {
    expect(() => buildRoutes([])).toThrow('No navigation destination is registered');
  });

  it('lands a signed-in user on Overview', async () => {
    const router = renderApp('/', signedInSession());

    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/overview');
  });

  it.each(PAGES)(
    'renders %s with its title in the top bar and its empty state',
    async (path, title, empty) => {
      renderApp(path, signedInSession());

      expect(await screen.findByText(empty)).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(within(nav).getByRole('link', { name: title })).toHaveClass('ciq-nav-item--active');
    },
  );

  it('sends a signed-out user to the sign-in page', async () => {
    const router = renderApp('/claims', signedOutSession());

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/signin');
  });

  it('keeps the navigation around the Not found page of an unknown address', async () => {
    renderApp('/nowhere', signedInSession());

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('shows the error state of a page whose loader fails, and recovers on retry', async () => {
    let failing = true;
    restores.push(
      configureScreenLoader(() =>
        failing
          ? Promise.reject(
              new ApiError({
                kind: 'server',
                status: 500,
                title: 'Broken',
                endpointId: 'claims',
              }),
            )
          : Promise.resolve(),
      ),
    );
    renderApp('/claims', signedInSession());
    expect(await screen.findByText('This could not be loaded')).toBeInTheDocument();

    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('No claims to list')).toBeInTheDocument();
  });

  it('shows the loading state while a page waits for its data', async () => {
    restores.push(configureScreenLoader(() => new Promise<void>(() => undefined)));
    renderApp('/suppliers', signedInSession());

    expect(await screen.findByText('Loading…')).toBeInTheDocument();
    expect(document.querySelector('[data-state="loading"]')).not.toBeNull();
  });
});
