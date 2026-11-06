/**
 * AuthProvider: owns the supabase-js session, keeps the Redux session slice in step with it, installs the API client
 * adapters (per-request token, tenant, 401 → sign-out) and applies the theme to `<html data-theme>`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { configureApiClient } from '../api/client';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { authSignedIn, signedOut } from '../app/slices/session';
import type { SignOutReason } from '../app/slices/session';
import type { AppStore } from '../app/store';
import { TENANT } from '../app/tenant';
import { AuthContext } from './authContext';
import type { AuthActions } from './authContext';
import { toSessionUser } from './sessionUser';
import { currentAccessToken, supabase } from './supabase';

export interface AuthProviderProps {
  readonly store: AppStore;
  readonly children: ReactNode;
}

export function AuthProvider({ store, children }: AuthProviderProps) {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.session.theme);
  const [recoverySession, setRecoverySession] = useState(false);
  const signOutReason = useRef<SignOutReason | null>(null);
  const signedInUserId = useRef<string | null>(null);

  // API client adapters: token per request, tenant while signed in, 401 → sign-out.
  useEffect(
    () =>
      configureApiClient({
        getAccessToken: currentAccessToken,
        getTenantId: () => (store.getState().session.authStatus === 'signedIn' ? TENANT.id : null),
        onUnauthorized: () => {
          if (store.getState().session.authStatus !== 'signedIn') {
            return;
          }
          signOutReason.current = 'expired';
          void supabase.auth.signOut({ scope: 'local' });
        },
      }),
    [store],
  );

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const actions = useMemo<AuthActions>(
    () => ({
      async signIn(email, password) {
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          return { ok: error === null };
        } catch {
          return { ok: false };
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
