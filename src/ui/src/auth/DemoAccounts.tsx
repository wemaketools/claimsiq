/**
 * DemoAccounts: the sign-in quick-pick of LOCAL DEVELOPMENT builds. Choosing an account fills its email and the
 * local password and signs in for real through supabase-js. Loaded only behind `import.meta.env.DEV` (see
 * SignInPage), so production builds do not contain it; `scan-bundle` checks the marker.
 */
import { Card } from '../components/ui/Card';
import { t } from '../lib/i18n';
import { DEMO_ACCOUNTS, DEMO_ACCOUNTS_MARKER, DEMO_PASSWORD } from './demoAccountList';

export interface DemoAccountsProps {
  readonly onPick: (email: string, password: string) => void;
  readonly disabled?: boolean;
}

export default function DemoAccounts({ onPick, disabled = false }: DemoAccountsProps) {
  return (
    <Card
      className="ciq-demo-accounts"
      title={t('auth.demo.title')}
      subtitle={t('auth.demo.subtitle', { password: DEMO_PASSWORD })}
      data-marker={DEMO_ACCOUNTS_MARKER}
      headingLevel={2}
    >
      <ul className="ciq-demo-list">
        {DEMO_ACCOUNTS.map((account) => (
          <li key={account.email}>
            <button
              type="button"
              className="ciq-demo-account"
              disabled={disabled}
              onClick={() => onPick(account.email, DEMO_PASSWORD)}
            >
              {account.fullName}
              <span className="ciq-demo-account-role">{account.email}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
