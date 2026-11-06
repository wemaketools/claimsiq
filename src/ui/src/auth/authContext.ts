/**
 * The authentication actions the providers expose. Session DATA (the user) lives in the Redux session slice; this
 * context only carries the operations of the build's mode: password operations over supabase-js, or the role
 * sign-in of a prototype build.
 */
import { createContext, useContext } from 'react';

import type { PersonaId } from '../app/personas';

export interface SignInResult {
  readonly ok: boolean;
}

interface CommonAuthActions {
  /** Ends the session; the session slice resets and the guard sends the visitor to sign-in. */
  signOut(): Promise<void>;
}

export interface PasswordAuthActions extends CommonAuthActions {
  readonly mode: 'supabase';
  /** Email + password sign-in. Any failure yields `{ ok: false }` (one generic message). */
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Sends the password-reset email (always resolves: the page never reveals whether the account exists). */
  requestPasswordReset(email: string): Promise<void>;
  /** Sets a new password during a recovery session. */
  updatePassword(password: string): Promise<{ readonly ok: boolean }>;
  /** True once a password-recovery link has produced a recovery session (on /reset-password). */
  readonly recoverySession: boolean;
}

export interface PrototypeAuthActions extends CommonAuthActions {
  readonly mode: 'prototype';
  /** Signs in as a demo role: no password, the session is the role. */
  signInAsRole(role: PersonaId): void;
}

export type AuthActions = PasswordAuthActions | PrototypeAuthActions;

export const AuthContext = createContext<AuthActions | null>(null);

export function useAuth(): AuthActions {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth must be used inside an auth provider.');
  }
  return value;
}

/** For the pages that exist only with passwords (the router sends prototype builds past them). */
export function usePasswordAuth(): PasswordAuthActions {
  const value = useAuth();
  if (value.mode !== 'supabase') {
    throw new Error('Password operations do not exist in a prototype build.');
  }
  return value;
}
