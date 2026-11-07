/**
 * The full-page loading state while the session is being established (the supabase-js session, or the prototype
 * session) and, in Supabase builds, while the Supabase provider's chunk loads (AppProviders' Suspense fallback).
 */
import { Wordmark } from '../auth/AuthLayout';
import { t } from '../lib/i18n';

export function LoadingScreen({ message }: { readonly message?: string }) {
  return (
    <div className="ciq-loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="ciq-loading-screen-inner">
        <Wordmark />
        <span className="ciq-btn-spinner" aria-hidden="true" />
        <span>{message ?? t('shell.loading.session')}</span>
      </div>
    </div>
  );
}
