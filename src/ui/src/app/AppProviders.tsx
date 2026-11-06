/**
 * The application providers, outermost first: the Redux store, authentication (the build mode's provider: API client
 * adapters, theme, session) and toasts. The router renders inside them.
 *
 * A prototype build never reaches the Supabase provider: the comparison below is inline so the bundler folds it to a
 * literal and drops the dynamic import, and with it supabase-js (see auth/authMode.ts).
 */
import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import type { ApiTransport } from '../api/client';
import { PrototypeAuthProvider } from '../auth/PrototypeAuthProvider';
import { ToastProvider } from '../components/ui/ToastProvider';
import { LoadingScreen } from '../pages/LoadingScreen';
import type { AppStore } from './store';

const SupabaseAuthProvider =
  import.meta.env.VITE_AUTH_MODE === 'prototype'
    ? null
    : lazy(() =>
        import('../auth/SupabaseAuthProvider').then((module) => ({
          default: module.SupabaseAuthProvider,
        })),
      );

export function AppProviders({
  store,
  children,
  transport,
}: {
  readonly store: AppStore;
  readonly children: ReactNode;
  readonly transport?: ApiTransport;
}) {
  const authProps = { store, ...(transport === undefined ? {} : { transport }) };
  return (
    <Provider store={store}>
      {SupabaseAuthProvider === null ? (
        <PrototypeAuthProvider {...authProps}>
          <ToastProvider>{children}</ToastProvider>
        </PrototypeAuthProvider>
      ) : (
        <Suspense fallback={<LoadingScreen />}>
          <SupabaseAuthProvider {...authProps}>
            <ToastProvider>{children}</ToastProvider>
          </SupabaseAuthProvider>
        </Suspense>
      )}
    </Provider>
  );
}
