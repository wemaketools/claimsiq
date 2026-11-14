/**
 * Sign-in. Prototype builds show the roles card and no form (PrototypeSignIn). Otherwise: email and password through supabase-js. Any failure shows ONE generic message, so the form cannot reveal
 * which accounts exist. After sign-in the user lands on the page they asked for, or on the screen of the active persona (`/`).
 *
 * While a request runs the fields are read-only (not disabled), so keyboard focus stays in the form; after a failure
 * focus returns to the password field.
 *
 * Below the card, the demo accounts: a click sends the account's email to the server, which signs it in with the demo
 * password of its environment (the browser holds no password), and sets the persona to the account's, as a role click
 * does in a prototype build. When the server cannot (no password configured, or it refuses), the email is filled into
 * the form, a short message says why and the persona stays as it was. A typed sign-in never touches the persona.
 */
import { Suspense, lazy, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import type { PersonaId } from '../app/personas';
import { choosePersona } from '../app/sessionActions';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/FormFields';
import { t } from '../lib/i18n';
import { AuthLayout } from './AuthLayout';
import { usePasswordAuth, useAuth } from './authContext';
import { PrototypeSignIn } from './PrototypeSignIn';

// The bundler folds the comparison to a literal, so a prototype build holds neither this import nor the account
// e-mails (a call to `authMode()` would not fold; see auth/authMode.ts).
const DemoSignInAccounts =
  import.meta.env.VITE_AUTH_MODE === 'prototype'
    ? null
    : lazy(() => import('./DemoSignInAccounts'));

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
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [demoNotice, setDemoNotice] = useState<'not_configured' | 'failed' | null>(null);

  const signIn = async (address: string, secret: string): Promise<void> => {
    setSubmitting(true);
    setFailed(false);
    setDemoNotice(null);
    const result = await auth.signIn(address.trim(), secret);
    setSubmitting(false);
    if (!result.ok) {
      setFailed(true);
      // Keyboard users continue where they were: back in the password field, next to the error message.
      document.getElementById(PASSWORD_FIELD_ID)?.focus();
    }
  };

  const signInAsDemo = async (address: string, persona: PersonaId): Promise<void> => {
    setSubmitting(true);
    setFailed(false);
    setDemoNotice(null);
    // Set before the call and put back on a failure: the session event of a success sends the visitor to `/` at once,
    // and `/` reads the persona.
    const previous = session.persona;
    dispatch(choosePersona(persona));
    const result = await auth.signInAsDemo(address);
    setSubmitting(false);
    if (!result.ok) {
      dispatch(choosePersona(previous));
      setEmail(address);
      setPassword('');
      setDemoNotice(result.reason);
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
        DemoSignInAccounts !== null && session.authStatus === 'signedOut' ? (
          <Suspense fallback={null}>
            <DemoSignInAccounts
              disabled={submitting}
              onPick={(address, persona) => void signInAsDemo(address, persona)}
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
        {demoNotice !== null && (
          <Banner tone="info">
            {demoNotice === 'not_configured' ? t('auth.demo.notConfigured') : t('auth.demo.failed')}
          </Banner>
        )}
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
