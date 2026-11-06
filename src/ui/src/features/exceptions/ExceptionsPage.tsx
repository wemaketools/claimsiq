import { useMemo, useState } from 'react';

import { SEVERITIES, endpoints, formatMoney } from '../../../../contracts/index';
import type { Severity } from '../../../../contracts/index';
import { useApiQuery } from '../../api/hooks';
import { useScreenFilters } from '../../app/hooks';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Reference,
  Select,
} from '../../components/ui';
import type { DataTableColumn, DataTableSort } from '../../components/ui';
import { EMPTY_VALUE, formatCount } from '../../lib/format';
import { t } from '../../lib/i18n';
import {
  ClaimFilterBar,
  ExportCsvButton,
  REASON_KEYS,
  SeverityChip,
  claimPath,
  reasonLabel,
  severityLabel,
  stageLabel,
  useClaimScope,
} from '../claim-scope';
import type { ReasonKey } from '../claim-scope';
import { CreateTaskDialog, suggestedPriority } from '../claim-tasks';
import { exceptionRows, exceptionsTable, filterRows, sortRows } from './rows';
import type { ExceptionRow } from './rows';

const SCREEN = 'exceptions';
const NO_FILTER = { severity: null, reason: null };

export default function ExceptionsPage() {
  const scope = useClaimScope();
  const tasks = useApiQuery(endpoints.tasksList, { query: { subject_type: 'CLAIM' } });
  const [stored, setStored] = useScreenFilters<{ severity: string | null; reason: string | null }>(
    SCREEN,
    NO_FILTER,
  );
  const severity = SEVERITIES.find((value) => value === stored.severity) ?? null;
  const reason = REASON_KEYS.find((value) => value === stored.reason) ?? null;
  const [sort, setSort] = useState<DataTableSort>({ key: 'severity', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [taskFor, setTaskFor] = useState<ExceptionRow | null>(null);

  const facts = scope.facts.data?.items;
  const lookups = scope.lookups.lookups;
  const taskItems = tasks.data?.items;

  const flagged = useMemo(() => {
    if (facts === undefined || lookups === undefined) return undefined;
    const openByClaim = new Map<string, number>();
    for (const task of taskItems ?? []) {
      if (task.status !== 'DONE') {
        openByClaim.set(task.subject_id, (openByClaim.get(task.subject_id) ?? 0) + 1);
      }
    }
    return exceptionRows(facts, lookups, (id) =>
      taskItems === undefined ? null : (openByClaim.get(id) ?? 0),
    );
  }, [facts, lookups, taskItems]);
  const rows = useMemo(
    () =>
      flagged === undefined ? undefined : sortRows(filterRows(flagged, { severity, reason }), sort),
    [flagged, severity, reason, sort],
  );
  const table = useMemo(() => (rows === undefined ? undefined : exceptionsTable(rows)), [rows]);

  const pageCount = Math.max(1, Math.ceil((rows?.length ?? 0) / pageSize));
  const current = Math.min(page, pageCount);
  const visible = rows?.slice((current - 1) * pageSize, current * pageSize);
  const queryError = scope.facts.error ?? scope.lookups.error;
  const narrowed = scope.filtered || severity !== null || reason !== null;
  const countOf = (value: Severity): number =>
    rows?.filter((row) => row.severity === value).length ?? 0;
  const unranked = rows?.filter((row) => row.severity === null).length ?? 0;

  const columns: DataTableColumn<ExceptionRow>[] = [
    {
      id: 'claim',
      header: t('exceptions.column.claim'),
      sortable: true,
      cell: (row) => <Reference value={row.id} to={claimPath(row.id)} />,
    },
    {
      id: 'severity',
      header: t('exceptions.column.severity'),
      sortable: true,
      cell: (row) =>
        row.severity === null ? EMPTY_VALUE : <SeverityChip severity={row.severity} />,
    },
    {
      id: 'reasons',
      header: t('exceptions.column.reasons'),
      width: '17rem',
      cell: (row) => (
        <ul className="ciq-list-plain">
          {row.reasons.map((item) => (
            <li key={item.key}>
              <strong>{item.label}</strong>{' '}
              <span className="ciq-mono ciq-text-muted">{item.key}</span>
              <span className="ciq-cell-sub">{item.text}</span>
            </li>
          ))}
        </ul>
      ),
    },
    { id: 'owner', header: t('exceptions.column.owner'), sortable: true, cell: (row) => row.owner },
    {
      id: 'daysLate',
      header: <span title={t('exceptions.daysLateHint')}>{t('exceptions.column.daysLate')}</span>,
      accessibleHeader: t('exceptions.column.daysLate'),
      sortable: true,
      numeric: true,
      cell: (row) => (row.daysLate === null ? EMPTY_VALUE : formatCount(row.daysLate)),
    },
    {
      id: 'stage',
      header: t('exceptions.column.stage'),
      sortable: true,
      cell: (row) => stageLabel(row.stage),
    },
    {
      id: 'incurred',
      header: t('exceptions.column.incurred'),
      sortable: true,
      numeric: true,
      cell: (row) => formatMoney(row.incurred),
    },
    {
      id: 'tasks',
      header: <span title={t('exceptions.tasksHint')}>{t('exceptions.column.tasks')}</span>,
      accessibleHeader: t('exceptions.column.tasks'),
      sortable: true,
      numeric: true,
      cell: (row) => (row.openTasks === null ? EMPTY_VALUE : formatCount(row.openTasks)),
    },
    {
      id: 'actions',
      header: t('exceptions.column.actions'),
      cell: (row) => (
        <Button
          size="sm"
          icon="plus"
          aria-label={t('claim-tasks.create.buttonFor', { claim: row.id })}
          onClick={() => setTaskFor(row)}
        >
          {t('claim-tasks.create.short')}
        </Button>
      ),
    },
  ];

  return (
    <div className="ciq-page">
      <PageHeader
        title={t('exceptions.title')}
        subtitle={t('exceptions.subtitle')}
        actions={<ExportCsvButton screen="exceptions" scope={scope} table={table} />}
      />
      <ClaimFilterBar
        scope={scope}
        extra={{
          active: severity !== null || reason !== null,
          clear: () => setStored(NO_FILTER),
          fields: (
            <>
              <Select
                label={t('exceptions.filter.severity')}
                placeholder={t('exceptions.filter.allSeverities')}
                value={severity ?? ''}
                options={SEVERITIES.map((value) => ({
                  value,
                  label: severityLabel(value),
                }))}
                onChange={(value) => {
                  setStored({ severity: value === '' ? null : value });
                  setPage(1);
                }}
              />
              <Select
                label={t('exceptions.filter.reason')}
                placeholder={t('exceptions.filter.allReasons')}
                value={reason ?? ''}
                options={REASON_KEYS.map((value: ReasonKey) => ({
                  value,
                  label: reasonLabel(value),
                }))}
                onChange={(value) => {
                  setStored({ reason: value === '' ? null : value });
                  setPage(1);
                }}
              />
            </>
          ),
        }}
      />
      {rows !== undefined && rows.length > 0 && (
        <p className="ciq-text-muted" role="status">
          {t('exceptions.summary', {
            count: rows.length,
            high: countOf('High'),
            medium: countOf('Medium'),
            low: countOf('Low'),
          })}
          {unranked > 0 && ` ${t('exceptions.summaryOther', { count: unranked })}`}
        </p>
      )}
      {tasks.error !== null && tasks.data === undefined && (
        <ErrorState
          error={tasks.error}
          onRetry={tasks.reload}
          title={t('exceptions.tasksUnknown')}
        />
      )}
      <DataTable
        caption={t('exceptions.caption')}
        columns={columns}
        rows={visible}
        rowKey={(row) => row.id}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        loading={queryError === null && rows === undefined}
        error={queryError}
        onRetry={() => {
          scope.facts.reload();
          scope.lookups.reload();
        }}
        empty={
          <EmptyState
            compact
            icon="alertTriangle"
            title={narrowed ? t('exceptions.empty.noMatchTitle') : t('exceptions.empty.title')}
            description={
              narrowed
                ? t('exceptions.empty.noMatchDescription')
                : t('exceptions.empty.description')
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
      {taskFor !== null && (
        <CreateTaskDialog
          claimId={taskFor.id}
          defaultPriority={suggestedPriority(taskFor.severity)}
          onClose={() => setTaskFor(null)}
        />
      )}
    </div>
  );
}
