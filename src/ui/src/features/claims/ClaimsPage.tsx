import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { endpoints, formatMoney } from '../../../../contracts/index';
import { useApiQuery } from '../../api/hooks';
import {
  Banner,
  ButtonLink,
  DataTable,
  EmptyState,
  PageHeader,
  Reference,
} from '../../components/ui';
import type { DataTableColumn, DataTableSort } from '../../components/ui';
import { EMPTY_VALUE, formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import {
  CLAIMS_PATH,
  CRITERION_PARAM,
  ClaimFilterBar,
  ExportCsvButton,
  SeverityChip,
  SlaChip,
  claimPath,
  describeCriterion,
  matchesCriterion,
  parseCriterion,
  stageLabel,
  useClaimScope,
} from '../claim-scope';
import { claimRows, claimsTable, sortRows } from './rows';
import type { ClaimRow } from './rows';

const BASE_COLUMNS: DataTableColumn<ClaimRow>[] = [
  {
    id: 'claim',
    header: t('claims.column.claim'),
    sortable: true,
    cell: (row) => <Reference value={row.id} to={claimPath(row.id)} />,
  },
  { id: 'client', header: t('claims.column.client'), sortable: true, cell: (row) => row.client },
  { id: 'product', header: t('claims.column.product'), sortable: true, cell: (row) => row.product },
  {
    id: 'stage',
    header: t('claims.column.stage'),
    sortable: true,
    cell: (row) => stageLabel(row.stage),
  },
  {
    id: 'age',
    header: t('claims.column.age'),
    sortable: true,
    numeric: true,
    cell: (row) => (row.ageDays === null ? EMPTY_VALUE : formatCount(row.ageDays)),
  },
  { id: 'handler', header: t('claims.column.handler'), sortable: true, cell: (row) => row.handler },
  {
    id: 'paid',
    header: t('claims.column.paid'),
    sortable: true,
    numeric: true,
    cell: (row) => formatMoney(row.paid),
  },
  {
    id: 'reserve',
    header: t('claims.column.reserve'),
    sortable: true,
    numeric: true,
    cell: (row) => formatMoney(row.reserve),
  },
  {
    id: 'incurred',
    header: t('claims.column.incurred'),
    sortable: true,
    numeric: true,
    cell: (row) => formatMoney(row.incurred),
  },
  {
    id: 'sla',
    header: t('claims.column.sla'),
    sortable: true,
    cell: (row) => (row.sla === null ? EMPTY_VALUE : <SlaChip status={row.sla} />),
  },
  {
    id: 'severity',
    header: t('claims.column.severity'),
    sortable: true,
    cell: (row) => (row.severity === null ? EMPTY_VALUE : <SeverityChip severity={row.severity} />),
  },
];

const PAID_IN_PERIOD: DataTableColumn<ClaimRow> = {
  id: 'paidInPeriod',
  header: t('claims.column.paidInPeriod'),
  sortable: true,
  numeric: true,
  cell: (row) => formatMoney(row.paidInPeriod),
};
const PERIOD_CRITERIA = ['new-in-period', 'paid-in-period', 'turnaround'];

/** The paid-in-period card lists claims, so the list shows the posted payments of the period that make its amount. */
const COLUMNS_WITH_PERIOD = BASE_COLUMNS.flatMap((column) =>
  column.id === 'paid' ? [column, PAID_IN_PERIOD] : [column],
);

export default function ClaimsPage() {
  const scope = useClaimScope();
  const [params] = useSearchParams();
  const [sort, setSort] = useState<DataTableSort>({ key: 'claim', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const shown = params.get(CRITERION_PARAM);
  const criterion = useMemo(() => parseCriterion(shown), [shown]);
  const facts = scope.facts.data?.items;
  const lookups = scope.lookups.lookups;
  const suppliers = useApiQuery(
    endpoints.suppliersList,
    criterion?.kind === 'supplier' ? {} : null,
  );
  const supplierName =
    criterion?.kind === 'supplier'
      ? suppliers.data?.items.find((supplier) => supplier.supplier_id === criterion.supplier)?.name
      : undefined;

  const rows = useMemo(() => {
    if (facts === undefined || lookups === undefined) return undefined;
    const selected =
      criterion === null ? facts : facts.filter((fact) => matchesCriterion(criterion, fact));
    return sortRows(claimRows(selected, lookups), sort);
  }, [facts, lookups, criterion, sort]);
  const paidInPeriod = criterion?.kind === 'paid-in-period';
  const table = useMemo(
    () => (rows === undefined ? undefined : claimsTable(rows, paidInPeriod)),
    [rows, paidInPeriod],
  );

  const pageCount = Math.max(1, Math.ceil((rows?.length ?? 0) / pageSize));
  const current = Math.min(page, pageCount);
  const visible = rows?.slice((current - 1) * pageSize, current * pageSize);
  const queryError = scope.facts.error ?? scope.lookups.error;
  const narrowed = scope.filtered || criterion !== null;

  return (
    <div className="ciq-page">
      <PageHeader
        title={t('claims.title')}
        subtitle={t('claims.subtitle')}
        actions={<ExportCsvButton screen="claims" queries={[scope.facts]} table={table} />}
      />
      <ClaimFilterBar
        scope={scope}
        withPeriod={criterion !== null && PERIOD_CRITERIA.includes(criterion.kind)}
      />
      {criterion !== null && (
        <Banner
          tone="info"
          actions={
            <ButtonLink to={CLAIMS_PATH} size="sm">
              {t('claims.criterion.showAll')}
            </ButtonLink>
          }
        >
          {t('claims.criterion.label')}: {describeCriterion(criterion, supplierName)}
          {rows !== undefined && <> · {t('claims.criterion.count', { count: rows.length })}</>}
        </Banner>
      )}
      {shown !== null && criterion === null && (
        <Banner tone="warning">{t('claims.criterion.unknown')}</Banner>
      )}
      <DataTable
        caption={t('claims.caption')}
        columns={paidInPeriod ? COLUMNS_WITH_PERIOD : BASE_COLUMNS}
        rows={visible}
        rowKey={(row) => row.id}
        sort={sort}
        onSortChange={setSort}
        loading={queryError === null && rows === undefined}
        error={queryError}
        onRetry={() => {
          scope.facts.reload();
          scope.lookups.reload();
        }}
        empty={
          <EmptyState
            compact
            icon="folder"
            title={narrowed ? t('claims.empty.noMatchTitle') : t('claims.empty.title')}
            description={
              narrowed ? t('claims.empty.noMatchDescription') : t('claims.empty.description')
            }
          />
        }
        pagination={{
          page: current,
          pageSize,
          total: rows?.length ?? 0,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          pageSizes: [25, 50, 100],
        }}
      />
    </div>
  );
}
