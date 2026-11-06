/**
 * Sign-in. Prototype builds show the roles card and no form (PrototypeSignIn). Otherwise: email and password through supabase-js. Any failure shows ONE generic message, so the form cannot reveal
 * which accounts exist. After sign-in the user lands on the page they asked for, or on the first destination.
 *
 * While a request runs the fields are read-only (not disabled), so keyboard focus stays in the form; after a failure
 * focus returns to the password field.
 *
 * In local development builds only, the demo-accounts quick-pick is loaded below the card.
 */
import { Suspense, lazy, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';

import { useAppSelector } from '../app/hooks';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/FormFields';
import { t } from '../lib/i18n';
import { AuthLayout } from './AuthLayout';
import { usePasswordAuth, useAuth } from './authContext';
import { PrototypeSignIn } from './PrototypeSignIn';

// Local development builds only: Vite replaces import.meta.env.DEV with false in production builds, so this lazy
// import and its module are removed from the bundle (scan-bundle verifies the marker is absent).
const DevDemoAccounts = import.meta.env.DEV ? lazy(() => import('./DevDemoAccounts')) : null;

const PASSWORD_FIELD_ID = 'ciq-signin-password';

interface FromState {
  readonly from?: string;
}

export function SignInPage() {
  const auth = useAuth();
  const location = useLocation();
  const authStatus = useAppSelector((state) => state.session.authStatus);
  const from = (location.state as FromState | null)?.from;

  if (authStatus === 'signedIn') {
    return <Navigate to={from !== undefined && from !== '/signin' ? from : '/'} replace />;
  }
  return auth.mode === 'prototype' ? <PrototypeSignIn auth={auth} /> : <PasswordSignIn />;
}

function PasswordSignIn() {
  const auth = usePasswordAuth();
  const session = useAppSelector((state) => state.session);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const signIn = async (address: string, secret: string): Promise<void> => {
    setSubmitting(true);
    setFailed(false);
    const result = await auth.signIn(address.trim(), secret);
    setSubmitting(false);
    if (!result.ok) {
      setFailed(true);
      // Keyboard users continue where they were: back in the password field, next to the error message.
      document.getElementById(PASSWORD_FIELD_ID)?.focus();
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void signIn(email, password);
  };

  return (
    <AuthLayout
      title={t('auth.signIn.title')}
      subtitle={t('auth.signIn.subtitle')}
      below={
        DevDemoAccounts !== null && session.authStatus === 'signedOut' ? (
          <Suspense fallback={null}>
            <DevDemoAccounts
              disabled={submitting}
              onPick={(pickedEmail, pickedPassword) => {
                setEmail(pickedEmail);
                setPassword(pickedPassword);
                void signIn(pickedEmail, pickedPassword);
              }}
            />
          </Suspense>
        ) : undefined
      }
    >
      <form onSubmit={onSubmit} noValidate aria-busy={submitting || undefined}>
        {session.signOutReason === 'expired' && !failed && (
          <Banner tone="info">{t('auth.signIn.expired')}</Banner>
        )}
        {failed && <Banner tone="error">{t('auth.signIn.failed')}</Banner>}
        <TextField
          label={t('auth.field.email')}
          type="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
          required
          readOnly={submitting}
          aria-disabled={submitting || undefined}
        />
        <TextField
          id={PASSWORD_FIELD_ID}
          label={t('auth.field.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
          readOnly={submitting}
          aria-disabled={submitting || undefined}
        />
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={email.trim() === '' || password === ''}
        >
          {submitting ? t('auth.signIn.signingIn') : t('auth.signIn.submit')}
        </Button>
      </form>
      <div className="ciq-auth-links">
        <Link to="/forgot-password">{t('auth.signIn.forgot')}</Link>
      </div>
    </AuthLayout>
  );
}
