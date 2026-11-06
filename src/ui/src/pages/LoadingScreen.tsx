/**
 * The full-page loading state while the session is being established (the supabase-js session).
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
