import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { features, navItemsFor } from '../../app/featureRegistry';
import type { FeatureModule } from '../../app/featureRegistry';
import { createAppStore } from '../../app/store';
import { signedInSession } from '../../test/fixtures';
import { renderWithProviders, stubAuth } from '../../test/render';
import { PageHeader } from '../ui/PageHeader';
import { PageSlotsContext } from '../ui/pageSlots';
import { AppShell } from './AppShell';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const SIX_DESTINATIONS = [
  'Overview',
  'Stages & Aging',
  'Exceptions & SLA',
  'Claims',
  'Suppliers',
  'Action Queue',
];

const modules: FeatureModule[] = [
  {
    id: 'demo',
    routes: [
      { path: 'first', element: <PageHeader title="First page" /> },
      { path: 'second', element: <PageHeader title="Second page" /> },
    ],
    nav: [
      { id: 'second', label: 'ui.action.dismiss', path: 'second', order: 2, icon: 'list' },
      { id: 'first', label: 'ui.action.retry', path: 'first', order: 1, icon: 'dashboard' },
    ],
  },
];

describe('Sidebar', () => {
  it('shows the tenant label, the wordmark and the sub-brand', () => {
    renderWithProviders(<Sidebar modules={modules} />, { state: { session: signedInSession() } });

    const sidebar = screen.getByRole('complementary', { name: 'Main navigation and account' });
    expect(within(sidebar).getByText('Fictional Botswana insurer demo')).toBeInTheDocument();
    expect(sidebar.querySelector('.ciq-brand-name')).toHaveTextContent('ClaimsIQ');
    expect(sidebar.querySelector('.ciq-brand-name .ciq-brand-iq')).toHaveTextContent('IQ');
    expect(within(sidebar).getByText('Claims Intelligence')).toBeInTheDocument();
  });

  it('lists the destinations in nav order and marks the current page', () => {
    renderWithProviders(<Sidebar modules={modules} />, {
      state: { session: signedInSession() },
      route: '/second',
    });

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/first', '/second']);
    expect(links[1]).toHaveClass('ciq-nav-item--active');
    expect(links[0]).not.toHaveClass('ciq-nav-item--active');
  });

  it('offers exactly the six ClaimsIQ destinations from the feature registry', () => {
    renderWithProviders(<Sidebar />, { state: { session: signedInSession() } });

    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(SIX_DESTINATIONS);
    expect(navItemsFor(features).map((item) => item.to)).toEqual([
      '/overview',
      '/stages',
      '/exceptions',
      '/claims',
      '/suppliers',
      '/actions',
    ]);
  });
});

describe('PageHeader in the shell', () => {
  it('renders no second heading in the page while the shell has not set its title slot yet', () => {
    renderWithProviders(
      <PageSlotsContext.Provider value={{ title: null }}>
        <PageHeader title="Claims" />
      </PageSlotsContext.Provider>,
    );

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});

describe('Topbar persona switch', () => {
  function renderTopbar(store = createAppStore({ session: signedInSession() })) {
    renderWithProviders(
      <Topbar
        titleRef={() => undefined}
        onOpenMenu={() => undefined}
        menuOpen={false}
        sidebarId="s"
      />,
      { store },
    );
    return store;
  }

  it('offers the four personas and shows the active one', () => {
    renderTopbar();

    const select = screen.getByRole('combobox', { name: 'Viewing as' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Head of Claims', 'Claims Handler', 'Supplier Coordinator', 'Finance']);
    expect(select).toHaveValue('head-of-claims');
  });

  it('changes the active persona and remembers it for the next visit', async () => {
    const store = renderTopbar();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Viewing as' }), 'finance');

    expect(store.getState().session.persona).toBe('finance');
    expect(createAppStore().getState().session.persona).toBe('finance');
  });

  it('ignores a stored persona it does not know', () => {
    window.localStorage.setItem('ciq.persona', 'ceo');

    expect(createAppStore().getState().session.persona).toBe('head-of-claims');
  });

  it('toggles between the light and the dark theme and remembers the choice', async () => {
    const store = renderTopbar();

    await userEvent.click(screen.getByRole('button', { name: 'Use dark theme' }));

    expect(store.getState().session.theme).toBe('dark');
    expect(createAppStore().getState().session.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Use light theme' })).toBeInTheDocument();
  });
});

describe('AppShell', () => {
  it('shows the user card with the name and the active persona, and signs out from its menu', async () => {
    const auth = stubAuth();
    renderWithProviders(<AppShell modules={modules} />, {
      state: { session: signedInSession({ persona: 'claims-handler' }) },
      auth,
    });

    const trigger = screen.getByRole('button', { name: /^Head of Claims/ });
    expect(trigger).toHaveTextContent('Claims Handler');
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(auth.signOut).toHaveBeenCalled();
  });

  it('switches the theme from the account menu', async () => {
    const store = createAppStore({ session: signedInSession() });
    renderWithProviders(<AppShell modules={modules} />, { store });

    await userEvent.click(screen.getByRole('button', { name: /^Head of Claims/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Use dark theme' }));

    expect(store.getState().session.theme).toBe('dark');
  });
});

describe('AppShell navigation drawer (below 768px)', () => {
  function phoneWidth(): void {
    const original = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      ...original(query),
      matches: query === '(max-width: 767px)',
    }));
  }

  it('moves focus into the opened drawer, closes it on Escape and returns focus to the menu button', async () => {
    phoneWidth();
    renderWithProviders(<AppShell modules={modules} />, {
      state: { session: signedInSession() },
      route: '/first',
    });
    const menuButton = screen.getByRole('button', { name: 'Open navigation' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.ciq-app')).not.toHaveClass('ciq-app--drawer-open');

    await userEvent.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getAllByRole('link')[0]).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveFocus();
  });

  it('sends focus to the main region after a nav link is followed', async () => {
    phoneWidth();
    renderWithProviders(<AppShell modules={modules} />, {
      state: { session: signedInSession() },
      route: '/first',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    await userEvent.click(within(nav).getByRole('link', { name: 'Dismiss' }));

    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('main')).toHaveFocus();
  });
});
