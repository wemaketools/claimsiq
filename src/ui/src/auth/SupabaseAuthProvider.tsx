/**
 * SupabaseAuthProvider: owns the supabase-js session and keeps the Redux session slice in step with it; its 401
 * handler signs out. Loaded only by builds in `supabase` mode (see AppProviders).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { call, isApiError } from '../api/client';
import type { ApiTransport } from '../api/client';
import { useAppDispatch } from '../app/hooks';
import { DEMO_SIGN_IN_NOT_CONFIGURED_CODE, publicEndpoints } from '../../../contracts/index';
import { authSignedIn, signedOut } from '../app/slices/session';
import type { SignOutReason } from '../app/slices/session';
import type { AppStore } from '../app/store';
import { AuthContext } from './authContext';
import type { PasswordAuthActions } from './authContext';
import { useApiClientAdapters, useThemeOnDocument } from './sessionEffects';
import { toSessionUser } from './sessionUser';
import { currentAccessToken, supabase } from './supabase';

export interface SupabaseAuthProviderProps {
  readonly store: AppStore;
  readonly children: ReactNode;
  /** Where API calls go; the platform `fetch` when omitted. */
  readonly transport?: ApiTransport;
}

export function SupabaseAuthProvider({ store, children, transport }: SupabaseAuthProviderProps) {
  const dispatch = useAppDispatch();
  const [recoverySession, setRecoverySession] = useState(false);
  const signOutReason = useRef<SignOutReason | null>(null);
  const signedInUserId = useRef<string | null>(null);

  const onUnauthorized = useCallback(() => {
    if (store.getState().session.authStatus !== 'signedIn') {
      return;
    }
    signOutReason.current = 'expired';
    void supabase.auth.signOut({ scope: 'local' });
  }, [store]);
  useApiClientAdapters({ store, transport, getAccessToken: currentAccessToken, onUnauthorized });
  useThemeOnDocument();

  // Supabase session → session slice.
  useEffect(() => {
    const handle = (event: AuthChangeEvent, session: Session | null): void => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoverySession(true);
      }
      if (session === null) {
        signedInUserId.current = null;
        dispatch(signedOut(signOutReason.current ?? undefined));
        signOutReason.current = null;
        return;
      }
      if (event === 'TOKEN_REFRESHED' || signedInUserId.current === session.user.id) {
        return;
      }
      signedInUserId.current = session.user.id;
      dispatch(authSignedIn({ user: toSessionUser(session.user) }));
    };
    const { data } = supabase.auth.onAuthStateChange(handle);
    return () => data.subscription.unsubscribe();
  }, [dispatch]);

  const actions = useMemo<PasswordAuthActions>(
    () => ({
      mode: 'supabase',
      async signIn(email, password) {
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          return { ok: error === null };
        } catch {
          return { ok: false };
        }
      },
      async signInAsDemo(email) {
        try {
          const session = await call(publicEndpoints.authDemoSignIn, { body: { email } });
          const { error } = await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          return error === null ? { ok: true } : { ok: false, reason: 'failed' };
        } catch (error) {
          const notConfigured =
            isApiError(error) && error.code === DEMO_SIGN_IN_NOT_CONFIGURED_CODE;
          return { ok: false, reason: notConfigured ? 'not_configured' : 'failed' };
        }
      },
      async signOut() {
        signOutReason.current = 'user';
        await supabase.auth.signOut({ scope: 'local' });
      },
      async requestPasswordReset(email) {
        try {
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });
        } catch {
          // The page shows the same confirmation either way (no account enumeration).
        }
      },
      async updatePassword(password) {
        try {
          const { error } = await supabase.auth.updateUser({ password });
          return { ok: error === null };
        } catch {
          return { ok: false };
        }
      },
      recoverySession,
    }),
    [recoverySession],
  );

  return <AuthContext.Provider value={actions}>{children}</AuthContext.Provider>;
}
