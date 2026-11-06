/**
 * DemoSignInAccounts: the demo-accounts card of the password sign-in page, one button per account of
 * `src/contracts/demoAccounts.ts`. Loaded lazily and only outside prototype builds (see SignInPage), which list roles
 * and ship no account e-mail; `scan-bundle --prototype` checks that.
 */
import { DEMO_ACCOUNTS } from '../../../contracts/index';
import { t } from '../lib/i18n';
import { DemoAccounts } from './DemoAccounts';

export interface DemoSignInAccountsProps {
  readonly onPick: (email: string) => void;
  readonly disabled?: boolean;
}

export default function DemoSignInAccounts({ onPick, disabled = false }: DemoSignInAccountsProps) {
  return (
    <DemoAccounts
      title={t('auth.demo.title')}
      subtitle={t('auth.demo.subtitle')}
      accounts={DEMO_ACCOUNTS.map((account) => ({
        id: account.email,
        name: account.fullName,
        detail: account.email,
      }))}
      onPick={onPick}
      disabled={disabled}
    />
  );
}
