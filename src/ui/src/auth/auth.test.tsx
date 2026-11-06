import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { signedInSession, signedOutSession } from '../test/fixtures';
import { LocationProbe, renderWithProviders, stubAuth } from '../test/render';
import { DEMO_ACCOUNTS, DEMO_ACCOUNTS_MARKER } from './demoAccountList';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { SignInPage } from './SignInPage';

const signedOut = signedOutSession();

describe('SignInPage', () => {
  it('signs in with email and password and shows ONE generic message on failure', async () => {
    const auth = stubAuth({ signIn: vi.fn(() => Promise.resolve({ ok: false })) });
    renderWithProviders(<SignInPage />, { state: { session: signedOut }, auth });
    await userEvent.type(screen.getByLabelText(/Email address/), 'someone@claimsiq.local');
    await userEvent.type(screen.getByLabelText(/Password/), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.signIn).toHaveBeenCalledWith('someone@claimsiq.local', 'wrong');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not sign you in with those details',
    );
  });

  it('keeps keyboard focus in the form while signing in and returns it to the password field after a failure', async () => {
    let resolve: (value: { ok: boolean }) => void = () => undefined;
    const auth = stubAuth({
      signIn: vi.fn(
        () =>
          new Promise<{ ok: boolean }>((done) => {
            resolve = done;
          }),
      ),
    });
    renderWithProviders(<SignInPage />, { state: { session: signedOut }, auth });
    await userEvent.type(screen.getByLabelText(/Email address/), 'someone@claimsiq.local');
    const password = screen.getByLabelText(/Password/);
    await userEvent.type(password, 'wrong{Enter}');
    expect(password).not.toBeDisabled();
    expect(password).toHaveAttribute('readonly');
    expect(password).toHaveAttribute('aria-disabled', 'true');
    expect(password).toHaveFocus();
    resolve({ ok: false });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(password).toHaveFocus();
    expect(password).not.toHaveAttribute('readonly');
  });

  it('lists the demo accounts in development builds and signs in for real with the chosen one', async () => {
    const auth = stubAuth();
    renderWithProviders(<SignInPage />, { state: { session: signedOut }, auth });

    const finance = await screen.findByRole('button', { name: /Sign in as Finance/ });
    expect(document.querySelector(`[data-marker="${DEMO_ACCOUNTS_MARKER}"]`)).not.toBeNull();
    await userEvent.click(finance);

    expect(auth.signIn).toHaveBeenCalledWith('finance@claimsiq.local', 'test1234');
    const emails = DEMO_ACCOUNTS.map((account) => account.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('explains an expired session', () => {
    renderWithProviders(<SignInPage />, {
      state: { session: { ...signedOut, signOutReason: 'expired' } },
    });
    expect(screen.getByText('Your session ended. Sign in again to continue.')).toBeInTheDocument();
  });

  it('sends a signed-in user to the page they asked for, or to the start', () => {
    renderWithProviders(<SignInPage />, {
      state: { session: signedInSession() },
      path: '/signin',
      route: '/signin',
      routes: [{ path: '/', element: <LocationProbe label="start" /> }],
    });

    expect(screen.getByTestId('location-probe')).toHaveTextContent('start');
  });
});

describe('ForgotPasswordPage', () => {
  it('always confirms, whether or not the account exists', async () => {
    const auth = stubAuth();
    renderWithProviders(<ForgotPasswordPage />, { state: { session: signedOut }, auth });
    await userEvent.type(screen.getByLabelText(/Email address/), 'nobody@claimsiq.local');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('nobody@claimsiq.local');
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });
});

describe('ResetPasswordPage', () => {
  it('asks for a new link without a recovery session', () => {
    renderWithProviders(<ResetPasswordPage />, { state: { session: signedOut } });
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('validates and saves the new password in a recovery session', async () => {
    const auth = stubAuth({ recoverySession: true });
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
});
