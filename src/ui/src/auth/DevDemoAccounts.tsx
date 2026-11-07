/**
 * DevDemoAccounts: the sign-in quick-pick of LOCAL DEVELOPMENT builds. Choosing an account fills its email and the
 * local password and signs in for real through supabase-js. Loaded only behind `import.meta.env.DEV` (see
 * SignInPage), so production builds do not contain it; `scan-bundle` checks the marker.
 */
import { t } from '../lib/i18n';
import { DemoAccounts } from './DemoAccounts';
import { DEMO_ACCOUNTS, DEMO_ACCOUNTS_MARKER, DEMO_PASSWORD } from './demoAccountList';

export interface DevDemoAccountsProps {
  readonly onPick: (email: string, password: string) => void;
  readonly disabled?: boolean;
}

export default function DevDemoAccounts({ onPick, disabled = false }: DevDemoAccountsProps) {
  return (
    <DemoAccounts
      title={t('auth.demo.title')}
      subtitle={t('auth.demo.subtitle', { password: DEMO_PASSWORD })}
      accounts={DEMO_ACCOUNTS.map((account) => ({
        id: account.email,
        name: account.fullName,
        detail: account.email,
      }))}
      onPick={(email) => onPick(email, DEMO_PASSWORD)}
      disabled={disabled}
      marker={DEMO_ACCOUNTS_MARKER}
    />
  );
}
