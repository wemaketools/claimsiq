import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PERSONA_IDS } from '../app/personas';
import { t } from '../lib/i18n';
import { LocationProbe, renderWithProviders, stubAuth } from '../test/render';
import { signedInSession, signedOutSession } from '../test/fixtures';
import { DEMO_ACCOUNTS, DEMO_ACCOUNTS_MARKER } from './demoAccountList';
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

  it('lists one demo account per persona in development builds and signs in with the chosen one; a signed-in visitor is sent on', async () => {
    const auth = stubAuth();
    const { unmount } = renderWithProviders(<SignInPage />, {
      state: { session: signedOut },
      auth,
    });
    expect(document.querySelector(`[data-marker="${DEMO_ACCOUNTS_MARKER}"]`)).not.toBeNull();
    expect(DEMO_ACCOUNTS.map((account) => account.fullName)).toEqual(
      PERSONA_IDS.map((id) => t(`shell.persona.${id}`)),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Finance/ }));

    expect(auth.signIn).toHaveBeenCalledWith('finance@claimsiq.local', 'test1234');
    unmount();

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
  it('always confirms a reset request, and validates and saves a new password in a recovery session', async () => {
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

    renderWithProviders(<ResetPasswordPage />, { state: { session: signedOut }, auth });
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
  });

  it('asks for a new link when there is no recovery session', () => {
    renderWithProviders(<ResetPasswordPage />, { state: { session: signedOut } });

    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
