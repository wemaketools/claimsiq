/**
 * DemoAccounts: the sign-in card of demo accounts, one two-line button each. It shows what its props say and imports
 * no account list, so prototype builds can ship it; the local-development quick-pick that fills the Supabase form is
 * DevDemoAccounts.
 */
import { Card } from '../components/ui/Card';

export interface DemoAccountEntry<Id extends string> {
  readonly id: Id;
  /** First line. */
  readonly name: string;
  /** Second line. */
  readonly detail: string;
}

export interface DemoAccountsProps<Id extends string> {
  readonly title: string;
  readonly subtitle: string;
  readonly accounts: readonly DemoAccountEntry<Id>[];
  readonly onPick: (id: Id) => void;
  readonly disabled?: boolean;
  /** Set as `data-marker`, so a test or scan can find the card. */
  readonly marker?: string;
}

export function DemoAccounts<Id extends string>({
  title,
  subtitle,
  accounts,
  onPick,
  disabled = false,
  marker,
}: DemoAccountsProps<Id>) {
  return (
    <Card
      className="ciq-demo-accounts"
      title={title}
      subtitle={subtitle}
      data-marker={marker}
      headingLevel={2}
    >
      <ul className="ciq-demo-list">
        {accounts.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              className="ciq-demo-account"
              disabled={disabled}
              onClick={() => onPick(account.id)}
            >
              {account.name}
              <span className="ciq-demo-account-role">{account.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
