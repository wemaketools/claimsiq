import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_ACCOUNTS } from '../../../contracts/index';
import { LandingRedirect } from '../app/LandingRedirect';
import { PERSONA_IDS, PERSONA_LANDING } from '../app/personas';
import { authSignedIn, personaChanged, signedOut as signedOutAction } from '../app/slices/session';
import { createAppStore } from '../app/store';
import { t } from '../lib/i18n';
import { LocationProbe, renderWithProviders, stubAuth } from '../test/render';
import { makeUser, signedInSession, signedOutSession } from '../test/fixtures';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { SignInPage } from './SignInPage';

const signedOut = signedOutSession();

describe('sign-in', () => {
  it('explains an expired session, keeps focus in the form while signing in, and shows one generic message on failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let resolve: (value: { ok: boolean }) => void = () => undefined;
    const auth = stubAuth({
      signIn: vi.fn(
        () =>
          new Promise<{ ok: boolean }>((done) => {
            resolve = done;
          }),
      ),
    });
    const { container } = renderWithProviders(<SignInPage />, {
      state: { session: { ...signedOut, signOutReason: 'expired' } },
      auth,
    });
    expect(screen.getByText('Your session ended. Sign in again to continue.')).toBeInTheDocument();
    expect(container.querySelector('form')).not.toHaveAttribute('aria-busy');

    await userEvent.type(screen.getByLabelText(/Email address/), 'someone@claimsiq.local');
    const password = screen.getByLabelText(/Password/);
    await userEvent.type(password, 'wrong{Enter}');

    expect(auth.signIn).toHaveBeenCalledWith('someone@claimsiq.local', 'wrong');
    expect(container.querySelector('form')).toHaveAttribute('aria-busy', 'true');
    expect(password).toHaveAttribute('readonly');
    expect(password).toHaveFocus();
    resolve({ ok: false });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not sign you in with those details',
    );
    expect(password).toHaveFocus();
    expect(password).not.toHaveAttribute('readonly');
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('lists one demo account per persona and signs in as the chosen one through the server; a success sets that persona and lands on its screen unless a deep link was asked for, a failure fills the email, says why and keeps the persona, and a typed sign-in leaves it alone; a signed-in visitor is sent on', async () => {
    const store = createAppStore({ session: signedOut });
    const markSignedIn = (): void => {
      store.dispatch(authSignedIn({ user: makeUser() }));
    };
    const auth = stubAuth({
      signInAsDemo: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, reason: 'not_configured' })
        .mockResolvedValueOnce({ ok: false, reason: 'failed' })
        .mockImplementation(() => {
          markSignedIn();
          return Promise.resolve({ ok: true });
        }),
      signIn: vi.fn(() => {
        markSignedIn();
        return Promise.resolve({ ok: true });
      }),
    });
    const landingRoutes = [
      { path: '/', element: <LandingRedirect destinations={Object.values(PERSONA_LANDING)} /> },
      { path: '/digest', element: <LocationProbe label="digest" /> },
      { path: '/claims', element: <LocationProbe label="claims" /> },
    ];
    const options = { store, path: '/signin', route: '/signin', routes: landingRoutes };
    const first = renderWithProviders(<SignInPage />, { ...options, auth });
    expect(screen.getByRole('heading', { name: 'Demo accounts' })).toBeInTheDocument();
    expect(DEMO_ACCOUNTS.map((account) => account.fullName)).toEqual(
      PERSONA_IDS.map((id) => t(`shell.persona.${id}`)),
    );
    expect(DEMO_ACCOUNTS.map((account) => account.persona)).toEqual(PERSONA_IDS);

    await userEvent.click(await screen.findByRole('button', { name: /Finance/ }));
    expect(auth.signInAsDemo).toHaveBeenLastCalledWith('finance@claimsiq.local');
    expect(
      await screen.findByText(/Demo sign-in is not set up in this environment/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/)).toHaveValue('finance@claimsiq.local');
    expect(screen.getByLabelText(/Password/)).toHaveFocus();
    expect(store.getState().session.persona).toBe('head-of-claims');

    await userEvent.click(screen.getByRole('button', { name: /Claims Handler/ }));
    expect(
      await screen.findByText(/Demo sign-in did not work for this account/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/)).toHaveValue('claims.handler@claimsiq.local');
    expect(store.getState().session.persona).toBe('head-of-claims');
    expect(window.localStorage.getItem('ciq.persona')).toBe('head-of-claims');

    await userEvent.click(screen.getByRole('button', { name: /Finance/ }));
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('digest');
    expect(store.getState().session.persona).toBe('finance');
    expect(auth.signIn).not.toHaveBeenCalled();
    first.unmount();

    // A signed-out deep link still wins over the landing screen of the account's persona.
    store.dispatch(signedOutAction());
    const deepLinked = renderWithProviders(<SignInPage />, { ...options, auth });
    await act(() => deepLinked.router.navigate('/signin', { state: { from: '/claims' } }));
    await userEvent.click(await screen.findByRole('button', { name: /Head of Claims/ }));
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('claims');
    expect(store.getState().session.persona).toBe('head-of-claims');
    deepLinked.unmount();

    // A typed sign-in keeps the stored persona.
    store.dispatch(signedOutAction());
    store.dispatch(personaChanged('finance'));
    const typed = renderWithProviders(<SignInPage />, { ...options, auth });
    await userEvent.type(screen.getByLabelText(/Email address/), 'head.of.claims@claimsiq.local');
    await userEvent.type(screen.getByLabelText(/Password/), 'secret{Enter}');
    expect(await screen.findByTestId('location-probe')).toHaveTextContent('digest');
    expect(store.getState().session.persona).toBe('finance');
    typed.unmount();

    renderWithProviders(<SignInPage />, {
      state: { session: signedInSession() },
      path: '/signin',
      route: '/signin',
      routes: [{ path: '/', element: <LocationProbe label="start" /> }],
    });
    expect(screen.getByTestId('location-probe')).toHaveTextContent('start');
  });
});

describe('password recovery', () => {
  it('always confirms a reset request, validates and saves a new password in a recovery session, and asks for a new link without one', async () => {
    const auth = stubAuth({ recoverySession: true });
    const { unmount } = renderWithProviders(<ForgotPasswordPage />, {
      state: { session: signedOut },
      auth,
    });
    await userEvent.type(screen.getByLabelText(/Email address/), 'nobody@claimsiq.local');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('nobody@claimsiq.local');
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    unmount();

    const reset = renderWithProviders(<ResetPasswordPage />, {
      state: { session: signedOut },
      auth,
    });
    await userEvent.type(screen.getByLabelText(/^New password/), 'short');
    expect(
      screen.getByText('Use at least 8 characters.', { selector: '.ciq-field-error' }),
    ).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/^New password/));
    await userEvent.type(screen.getByLabelText(/^New password/), 'longenough1');
    await userEvent.type(screen.getByLabelText(/Confirm the new password/), 'longenough2');
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/Confirm the new password/));
    await userEvent.type(screen.getByLabelText(/Confirm the new password/), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: 'Save the new password' }));

    expect(auth.updatePassword).toHaveBeenCalledWith('longenough1');
    await waitFor(() => expect(screen.getByText('Password changed')).toBeInTheDocument());
    reset.unmount();

    renderWithProviders(<ResetPasswordPage />, { state: { session: signedOut } });

    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
