import type { ClaimsSummary } from '../../../../contracts/index';
import { formatMoney } from '../../../../contracts/index';
import { formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';

/** The open claims and their money, which every table of the Stages page adds up to. */
export function OpenTotals({ summary }: { readonly summary: ClaimsSummary }) {
  const total = summary.open_totals;
  return (
    <span>
      {t('stages.total')}: {formatCount(summary.open)} · {formatMoney(total.paid)} ·{' '}
      {formatMoney(total.reserve)} · {formatMoney(total.incurred)}
    </span>
  );
}
