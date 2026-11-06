import type { z } from 'zod';

import { formatMoney } from '../../../../contracts/index';
import type { endpoints } from '../../../../contracts/index';
import type { QueryResult } from '../../api/hooks';
import { useAppSelector } from '../../app/hooks';
import { GroupedBarChart } from '../../components/charts';
import { Card, EmptyState, QueryView, SkeletonBlock } from '../../components/ui';
import { formatCalendarDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { plottedMoney, trendPoints } from './trends';

export type PaidTrendAnswer = z.infer<typeof endpoints.claimsPaidTrend.response>;

/** Posted paid per calendar month up to the as-of date for the claims in view; the period selector does not narrow it. */
export function PaidTrendCard({ query }: { readonly query: QueryResult<PaidTrendAnswer> }) {
  const asOf = useAppSelector((state) => state.dataContext.asOf);
  return (
    <Card
      aria-label={t('overview.trend.title')}
      title={t('overview.trend.title')}
      subtitle={t('overview.trend.subtitle', { date: formatCalendarDate(asOf) })}
      data-state={query.data === undefined ? query.status : 'ready'}
    >
      <QueryView
        query={query}
        loading={<SkeletonBlock lines={4} />}
        errorTitle={t('overview.trend.error')}
        isEmpty={(data) => data.payments === 0}
        empty={
          <EmptyState
            compact
            icon="receipt"
            title={t('overview.trend.empty.title')}
            description={t('overview.trend.empty.description')}
          />
        }
      >
        {(data) => (
          <div className="ciq-stack" aria-busy={query.isFetching}>
            <GroupedBarChart
              label={t('overview.trend.chart')}
              categoryLabel={t('overview.trend.month')}
              series={[{ key: 'paid', label: t('overview.trend.series'), tone: 'accent' }]}
              points={trendPoints(data)}
              formatValue={plottedMoney}
              axisWidth={96}
            />
            <p className="ciq-text-muted">
              {t('overview.trend.summary', {
                total: formatMoney(data.total),
                payments: t('overview.trend.payments', { count: data.payments }),
                months: t('overview.trend.months', { count: data.buckets.length }),
              })}
            </p>
          </div>
        )}
      </QueryView>
    </Card>
  );
}
