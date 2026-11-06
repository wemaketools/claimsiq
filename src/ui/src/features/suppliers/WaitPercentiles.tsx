import type { SupplierInsights, WaitPercentiles as Percentiles } from '../../../../contracts/index';
import { GroupedBarChart } from '../../components/charts';
import { Card, Chip, DataTable, EmptyState } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { EMPTY_VALUE, formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import { baselineRow } from './rows';
import type { PercentileRow, SupplierRow } from './rows';

export function Placement({
  value,
  position,
}: {
  readonly value: number | null;
  readonly position: Percentiles['median_vs_target'];
}) {
  if (value === null || position === null) return <span>{EMPTY_VALUE}</span>;
  return (
    <>
      <span>{formatCount(value)}</span>
      <Chip tone={position === 'over' ? 'danger' : 'success'} size="sm">
        {t(position === 'over' ? 'suppliers.percentiles.over' : 'suppliers.percentiles.within')}
      </Chip>
    </>
  );
}

function columns(minimum: number): DataTableColumn<PercentileRow>[] {
  return [
    {
      id: 'supplier',
      header: t('suppliers.column.supplier'),
      width: '14rem',
      cell: (row) => (
        <>
          <span>{row.name}</span>
          {row.baseline && (
            <span className="ciq-cell-sub">{t('suppliers.percentiles.baselineHint')}</span>
          )}
        </>
      ),
    },
    {
      id: 'sample',
      header: t('suppliers.percentiles.column.sample'),
      numeric: true,
      cell: (row) => (
        <>
          <span>{formatCount(row.percentiles.sample)}</span>
          {row.percentiles.median === null && (
            <span className="ciq-cell-sub">
              {row.percentiles.sample === 0
                ? t('suppliers.noRequests')
                : t('suppliers.percentiles.notEnough', {
                    count: row.percentiles.sample,
                    minimum,
                  })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'median',
      header: t('suppliers.percentiles.column.median'),
      numeric: true,
      cell: (row) => (
        <Placement value={row.percentiles.median} position={row.percentiles.median_vs_target} />
      ),
    },
    {
      id: 'p90',
      header: t('suppliers.percentiles.column.p90'),
      numeric: true,
      cell: (row) => (
        <Placement value={row.percentiles.p90} position={row.percentiles.p90_vs_target} />
      ),
    },
  ];
}

/** Each supplier's median and 90th-percentile wait against the target and the all-supplier baseline; a supplier below the sample minimum shows its sample and no placement. */
export function WaitPercentilesCard({
  rows,
  answer,
}: {
  readonly rows: readonly SupplierRow[];
  readonly answer: SupplierInsights;
}) {
  const all: PercentileRow[] = [
    baselineRow(answer.all_suppliers),
    ...rows.map((row) => ({
      id: row.id,
      name: row.name,
      baseline: false,
      percentiles: row.insight.percentiles,
    })),
  ];
  const placed = all.filter((row) => row.percentiles.median !== null);
  return (
    <Card
      title={t('suppliers.percentiles.title')}
      subtitle={t('suppliers.percentiles.subtitle', {
        target: answer.target_business_days,
        count: answer.min_sample,
      })}
    >
      <div className="ciq-stack">
        {placed.length === 0 ? (
          <EmptyState
            compact
            icon="truck"
            title={t('suppliers.percentiles.nonePlaced', { count: answer.min_sample })}
          />
        ) : (
          <GroupedBarChart
            label={t('suppliers.percentiles.chart')}
            categoryLabel={t('suppliers.column.supplier')}
            series={[
              { key: 'median', label: t('suppliers.percentiles.column.median'), tone: 'info' },
              { key: 'p90', label: t('suppliers.percentiles.column.p90'), tone: 'warning' },
            ]}
            points={placed.map((row) => ({
              x: row.name,
              values: { median: row.percentiles.median, p90: row.percentiles.p90 },
            }))}
            reference={{
              value: answer.target_business_days,
              label: t('suppliers.percentiles.target', { target: answer.target_business_days }),
            }}
          />
        )}
        <DataTable
          caption={t('suppliers.percentiles.caption')}
          columns={columns(answer.min_sample)}
          rows={all}
          rowKey={(row) => row.id}
        />
        <p className="ciq-text-muted">{t('suppliers.percentiles.method')}</p>
      </div>
    </Card>
  );
}
