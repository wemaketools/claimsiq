/** Posted paid per month: the query behind the Overview chart, its points and its rows in the CSV. */
import { endpoints, formatMoney } from '../../../../contracts/index';
import type { PaidTrend } from '../../../../contracts/index';
import { useApiQuery } from '../../api/hooks';
import type { TrendPoint } from '../../components/charts';
import { t } from '../../lib/i18n';
import type { ClaimFilters } from '../claim-scope';

/** `2026-10` as `Oct 2026`. */
export const monthLabel = (month: string): string => {
  const [year = '', number = ''] = month.split('-');
  return `${t(`format.month.${Number(number)}`)} ${year}`;
};

export function usePaidTrend(filters: ClaimFilters) {
  const { policy_id, broker_id, product_id, handler_id } = filters;
  return useApiQuery(
    endpoints.claimsPaidTrend,
    {
      query: Object.fromEntries(
        Object.entries({ policy_id, broker_id, product_id, handler_id }).filter(
          ([, value]) => value !== null,
        ),
      ),
    },
    { keepPrevious: true },
  );
}

export const trendPoints = (trend: PaidTrend): TrendPoint[] =>
  trend.buckets.map((bucket) => ({
    x: monthLabel(bucket.month),
    values: { paid: Number(bucket.paid) },
  }));

/** Money for a plotted value: the label of an axis tick or tooltip, never a sum. */
export const plottedMoney = (value: number): string => formatMoney(value.toFixed(2));

/** CSV rows in the Overview's columns (`Section, Measure, Claims, Amount (BWP), Days`): a month per row and the total last. */
export function trendRows(trend: PaidTrend): string[][] {
  const section = t('overview.trend.title');
  return [
    ...trend.buckets.map((bucket) => [
      section,
      monthLabel(bucket.month),
      String(bucket.claims),
      bucket.paid,
      '',
    ]),
    [section, t('overview.trend.total'), '', trend.total, ''],
  ];
}
