/**
 * The application providers, outermost first: the Redux store, authentication (supabase-js session, API client
 * adapters, theme) and toasts. The router renders inside them.
 */
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import type { ApiTransport } from '../api/client';
import { AuthProvider } from '../auth/AuthProvider';
import { ToastProvider } from '../components/ui/ToastProvider';
import type { AppStore } from './store';

export function AppProviders({
  store,
  children,
  transport,
}: {
  readonly store: AppStore;
  readonly children: ReactNode;
  readonly transport?: ApiTransport;
}) {
  return (
    <Provider store={store}>
      <AuthProvider store={store} {...(transport === undefined ? {} : { transport })}>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </Provider>
  );
}
