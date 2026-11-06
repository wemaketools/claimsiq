import { useMemo } from 'react';
import { Link } from 'react-router';

import { endpoints } from '../../../../contracts/index';
import { useApiQuery } from '../../api/hooks';
import { Card, Chip, DataTable, EmptyState, PageHeader, SkeletonBlock } from '../../components/ui';
import type { DataTableColumn } from '../../components/ui';
import { EMPTY_VALUE, formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import {
  ClaimFilterBar,
  ExportCsvButton,
  claimFilterQuery,
  claimsLink,
  useClaimScope,
} from '../claim-scope';
import { oneDecimal, supplierRows, suppliersTable } from './rows';
import type { SupplierRow } from './rows';
import { WaitPercentilesCard } from './WaitPercentiles';

/** An average with the number of requests behind it: shown from the minimum sample, otherwise only the sample. */
function Average({
  sample,
  average,
  minimum,
  none,
  counted,
}: {
  readonly sample: number;
  readonly average: number | null;
  readonly minimum: number;
  readonly none: string;
  /** How the requests behind a shown average read, for example "2 requests". */
  readonly counted: string;
}) {
  return (
    <>
      <span>{average === null ? EMPTY_VALUE : oneDecimal(average)}</span>
      <span className="ciq-cell-sub">
        {sample === 0
          ? none
          : average === null
            ? t('suppliers.notEnough', { count: sample, minimum })
            : counted}
      </span>
    </>
  );
}

function columns(minimum: number): DataTableColumn<SupplierRow>[] {
  return [
    {
      id: 'supplier',
      header: t('suppliers.column.supplier'),
      width: '14rem',
      cell: (row) => (
        <>
          {row.insight.cases > 0 ? (
            <Link
              to={claimsLink({ kind: 'supplier', supplier: row.id })}
              aria-label={t('suppliers.viewCases', { supplier: row.name })}
            >
              {row.name}
            </Link>
          ) : (
            <span>{row.name}</span>
          )}
          <span className="ciq-cell-sub">
            {[row.serviceType, row.active ? null : t('suppliers.inactive')]
              .filter((part) => part !== null)
              .join(' · ')}
          </span>
        </>
      ),
    },
    {
      id: 'open',
      header: t('suppliers.column.open'),
      numeric: true,
      cell: (row) => (
        <>
          <span>{formatCount(row.insight.open_requests)}</span>
          {row.insight.unverified > 0 && (
            <span className="ciq-cell-sub">
              {t('suppliers.unverified', { count: row.insight.unverified })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'wait',
      header: t('suppliers.column.wait'),
      numeric: true,
      cell: (row) => (
        <Average
          sample={row.insight.wait.sample}
          average={row.insight.wait.average}
          minimum={minimum}
          none={t('suppliers.noRequests')}
          counted={t('suppliers.sample', { count: row.insight.wait.sample })}
        />
      ),
    },
    {
      id: 'longest',
      header: t('suppliers.column.longest'),
      numeric: true,
      cell: (row) => formatCount(row.insight.wait.longest),
    },
    {
      id: 'breaches',
      header: <span title={t('suppliers.hint.breaches')}>{t('suppliers.column.breaches')}</span>,
      accessibleHeader: t('suppliers.column.breaches'),
      numeric: true,
      cell: (row) =>
        row.insight.breaches > 0 ? (
          <Chip tone="danger" size="sm">
            {formatCount(row.insight.breaches)}
          </Chip>
        ) : (
          formatCount(0)
        ),
    },
    {
      id: 'cases',
      header: <span title={t('suppliers.hint.cases')}>{t('suppliers.column.cases')}</span>,
      accessibleHeader: t('suppliers.column.cases'),
      numeric: true,
      cell: (row) => formatCount(row.insight.open_assigned_cases),
    },
    {
      id: 'late',
      header: <span title={t('suppliers.hint.late')}>{t('suppliers.column.late')}</span>,
      accessibleHeader: t('suppliers.column.late'),
      numeric: true,
      cell: (row) => formatCount(row.insight.late_actions),
    },
    {
      id: 'turnaround',
      header: t('suppliers.column.turnaround'),
      numeric: true,
      cell: (row) => (
        <Average
          sample={row.insight.turnaround.sample}
          average={row.insight.turnaround.average}
          minimum={minimum}
          none={t('suppliers.noneCompleted')}
          counted={t('suppliers.completedSample', { count: row.insight.turnaround.sample })}
        />
      ),
    },
  ];
}

export default function SuppliersPage() {
  const scope = useClaimScope();
  const insights = useApiQuery(
    endpoints.suppliersInsights,
    { query: claimFilterQuery(scope.filters) },
    { keepPrevious: true },
  );
  const suppliers = useApiQuery(endpoints.suppliersList, {});

  const answer = insights.data;
  const names = suppliers.data?.items;
  const rows = useMemo(
    () =>
      answer === undefined || names === undefined ? undefined : supplierRows(answer.items, names),
    [answer, names],
  );
  const table = useMemo(
    () =>
      rows === undefined || answer === undefined
        ? undefined
        : suppliersTable(rows, answer.all_suppliers),
    [rows, answer],
  );
  const queryError = insights.error ?? suppliers.error;

  return (
    <div className="ciq-page">
      <PageHeader
        title={t('suppliers.title')}
        subtitle={t('suppliers.subtitle')}
        actions={
          <ExportCsvButton screen="suppliers" queries={[insights, suppliers]} table={table} />
        }
      />
      <ClaimFilterBar scope={scope} />
      {answer !== undefined && (
        <p className="ciq-text-muted">
          {t('suppliers.basis', {
            target: answer.target_business_days,
            count: answer.min_sample,
          })}
        </p>
      )}
      <DataTable
        caption={t('suppliers.caption')}
        columns={columns(answer?.min_sample ?? 0)}
        rows={rows}
        rowKey={(row) => row.id}
        loading={queryError === null && rows === undefined}
        error={queryError}
        onRetry={() => {
          insights.reload();
          suppliers.reload();
        }}
        empty={
          <EmptyState
            compact
            icon="truck"
            title={t('suppliers.empty.title')}
            description={t('suppliers.empty.description')}
          />
        }
      />
      {queryError === null &&
        (rows === undefined || answer === undefined ? (
          <Card data-state="loading">
            <SkeletonBlock lines={4} />
          </Card>
        ) : (
          rows.length > 0 && <WaitPercentilesCard rows={rows} answer={answer} />
        ))}
    </div>
  );
}
