import { useMemo, useState } from 'react';

import { TASK_PRIORITIES, TASK_STATUSES, endpoints } from '../../../../contracts/index';
import type { TaskListItem } from '../../../../contracts/index';
import { useApiQuery } from '../../api/hooks';
import { useScreenFilters } from '../../app/hooks';
import {
  Button,
  Chip,
  DataTable,
  DetailList,
  Dialog,
  EmptyState,
  ErrorState,
  FilterBar,
  IconButton,
  Menu,
  PageHeader,
  Reference,
  Select,
} from '../../components/ui';
import type { ChipTone, DataTableColumn, DataTableSort } from '../../components/ui';
import { EMPTY_VALUE } from '../../lib/format';
import { t } from '../../lib/i18n';
import { ExportCsvButton, claimPath, formatMoment } from '../claim-scope';
import {
  AssignTaskDialog,
  CreateTaskDialog,
  SetTaskStatusDialog,
  TaskAuditTimeline,
  TaskDue,
  TaskStatusChip,
  priorityLabel,
  statusLabel,
} from '../claim-tasks';
import { NO_OWNER, QUEUE_SORT, filterRows, queueRows, queueTable, sortRows } from './rows';
import type { QueueRow } from './rows';

const PRIORITY_TONE = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'neutral',
} as const satisfies Record<TaskListItem['priority'], ChipTone>;

const SCREEN = 'actions';
const NO_FILTER = { status: '', owner: '', priority: '' };

type OpenDialog =
  | { readonly kind: 'create' }
  | { readonly kind: 'assign' | 'status' | 'history'; readonly task: TaskListItem };

export default function ActionsPage() {
  const tasks = useApiQuery(endpoints.tasksList, {});
  const users = useApiQuery(endpoints.usersList, {});
  const facts = useApiQuery(endpoints.claimsFacts, { query: {} });
  const [stored, setStored, clearStored] = useScreenFilters(SCREEN, NO_FILTER);
  const status = TASK_STATUSES.find((value) => value === stored.status) ?? '';
  const priority = TASK_PRIORITIES.find((value) => value === stored.priority) ?? '';
  const owner = typeof stored.owner === 'string' ? stored.owner : '';
  const [sort, setSort] = useState<DataTableSort>(QUEUE_SORT);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);

  const taskItems = tasks.data?.items;
  const userItems = users.data?.items;
  const factItems = facts.data?.items;

  const all = useMemo(() => {
    if (taskItems === undefined || userItems === undefined) return undefined;
    const names = new Map(userItems.map((user) => [user.user_id, user.display_name]));
    return queueRows(taskItems, factItems, (id) => names.get(id) ?? id);
  }, [taskItems, userItems, factItems]);
  const rows = useMemo(
    () =>
      all === undefined ? undefined : sortRows(filterRows(all, { status, owner, priority }), sort),
    [all, status, owner, priority, sort],
  );
  const table = useMemo(() => (rows === undefined ? undefined : queueTable(rows)), [rows]);

  const queryError = tasks.error ?? users.error;
  const narrowed = status !== '' || owner !== '' || priority !== '';
  const countOf = (value: TaskListItem['status']): number =>
    rows?.filter((row) => row.task.status === value).length ?? 0;
  const userName = (id: string): string =>
    userItems?.find((user) => user.user_id === id)?.display_name ?? id;

  const columns: DataTableColumn<QueueRow>[] = [
    {
      id: 'claim',
      header: t('actions.column.claim'),
      sortable: true,
      cell: (row) => (
        <>
          {row.claim === null ? (
            <span>{row.task.subject_id}</span>
          ) : (
            <Reference value={row.claim} to={claimPath(row.claim)} />
          )}
          <span className="ciq-cell-sub ciq-mono">{row.id}</span>
        </>
      ),
    },
    {
      id: 'issue',
      header: t('actions.column.issue'),
      width: '12rem',
      cell: (row) =>
        row.issue === null ? (
          EMPTY_VALUE
        ) : row.issue.length === 0 ? (
          <span className="ciq-text-muted">{t('actions.noIssue')}</span>
        ) : (
          <ul className="ciq-list-plain">
            {row.issue.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        ),
    },
    {
      id: 'owner',
      header: t('actions.column.owner'),
      sortable: true,
      cell: (row) => row.owner ?? <span className="ciq-text-muted">{t('actions.unassigned')}</span>,
    },
    {
      id: 'due',
      header: t('actions.column.due'),
      sortable: true,
      cell: (row) => <TaskDue task={row.task} />,
    },
    {
      id: 'priority',
      header: t('actions.column.priority'),
      sortable: true,
      cell: (row) => (
        <Chip tone={PRIORITY_TONE[row.task.priority]} size="sm">
          {priorityLabel(row.task.priority)}
        </Chip>
      ),
    },
    {
      id: 'status',
      header: t('actions.column.status'),
      sortable: true,
      cell: (row) => <TaskStatusChip status={row.task.status} />,
    },
    {
      id: 'updated',
      header: t('actions.column.updated'),
      sortable: true,
      cell: (row) => formatMoment(row.task.updated_at),
    },
    {
      id: 'notes',
      header: t('actions.column.notes'),
      width: '13rem',
      cell: (row) =>
        row.task.note ?? <span className="ciq-text-muted">{t('actions.noNotes')}</span>,
    },
    {
      id: 'actions',
      header: t('actions.column.actions'),
      accessibleHeader: t('actions.column.actions'),
      cell: (row) => (
        <Menu
          label={t('actions.rowActions', { task: row.id })}
          entries={[
            {
              id: 'assign',
              label: t('claim-tasks.assign.button'),
              icon: 'users',
              onSelect: () => setDialog({ kind: 'assign', task: row.task }),
            },
            {
              id: 'status',
              label: t('claim-tasks.status.button'),
              icon: 'check',
              onSelect: () => setDialog({ kind: 'status', task: row.task }),
            },
            ...(row.claim === null
              ? []
              : [
                  {
                    kind: 'link' as const,
                    id: 'claim',
                    label: t('actions.openClaim'),
                    icon: 'externalLink' as const,
                    to: claimPath(row.claim),
                  },
                ]),
          ]}
          trigger={(props) => (
            <IconButton
              icon="moreHorizontal"
              variant="ghost"
              size="sm"
              label={t('actions.rowActions', { task: row.id })}
              {...props}
            />
          )}
        />
      ),
    },
  ];

  const detail = dialog !== null && dialog.kind === 'history' ? dialog.task : null;

  return (
    <div className="ciq-page">
      <PageHeader
        title={t('actions.title')}
        subtitle={t('actions.subtitle')}
        actions={
          <>
            <ExportCsvButton
              screen="actions"
              queries={[tasks, users]}
              optionalQueries={[facts]}
              table={table}
            />
            <Button variant="primary" icon="plus" onClick={() => setDialog({ kind: 'create' })}>
              {t('actions.create')}
            </Button>
          </>
        }
      />
      <FilterBar
        label={t('actions.filter.label')}
        onClear={() => {
          clearStored();
          setSort(QUEUE_SORT);
        }}
        canClear={narrowed || sort.key !== QUEUE_SORT.key}
      >
        <Select
          label={t('actions.filter.status')}
          placeholder={t('actions.filter.allStatuses')}
          value={status}
          options={TASK_STATUSES.map((value) => ({ value, label: statusLabel(value) }))}
          onChange={(value) => setStored({ status: value })}
        />
        <Select
          label={t('actions.filter.owner')}
          placeholder={t('actions.filter.allOwners')}
          value={owner}
          options={[
            { value: NO_OWNER, label: t('actions.filter.unassigned') },
            ...(userItems ?? []).map((user) => ({ value: user.user_id, label: user.display_name })),
          ]}
          onChange={(value) => setStored({ owner: value })}
        />
        <Select
          label={t('actions.filter.priority')}
          placeholder={t('actions.filter.allPriorities')}
          value={priority}
          options={TASK_PRIORITIES.map((value) => ({ value, label: priorityLabel(value) }))}
          onChange={(value) => setStored({ priority: value })}
        />
      </FilterBar>
      {rows !== undefined && rows.length > 0 && (
        <p className="ciq-text-muted" role="status">
          {t('actions.summary', {
            count: rows.length,
            overdue: rows.filter((row) => row.task.overdue).length,
            open: countOf('OPEN'),
            inProgress: countOf('IN_PROGRESS'),
            done: countOf('DONE'),
          })}
        </p>
      )}
      {facts.error !== null && facts.data === undefined && (
        <ErrorState error={facts.error} onRetry={facts.reload} title={t('actions.issuesUnknown')} />
      )}
      <DataTable
        caption={t('actions.caption')}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        rowLabel={(row) => t('actions.history.open', { task: row.id })}
        onRowClick={(row) => setDialog({ kind: 'history', task: row.task })}
        sort={sort}
        onSortChange={setSort}
        loading={queryError === null && rows === undefined}
        error={queryError}
        onRetry={() => {
          tasks.reload();
          users.reload();
        }}
        empty={
          <EmptyState
            compact
            icon="listChecks"
            title={narrowed ? t('actions.empty.noMatchTitle') : t('actions.empty.title')}
            description={
              narrowed ? t('actions.empty.noMatchDescription') : t('actions.empty.description')
            }
          />
        }
      />
      {dialog?.kind === 'create' && (
        <CreateTaskDialog claimId={null} defaultPriority="MEDIUM" onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'assign' && (
        <AssignTaskDialog task={dialog.task} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'status' && (
        <SetTaskStatusDialog task={dialog.task} onClose={() => setDialog(null)} />
      )}
      {detail !== null && (
        <Dialog
          open
          size="lg"
          title={t('actions.history.title', { task: detail.task_id })}
          description={t('actions.history.subtitle')}
          onClose={() => setDialog(null)}
        >
          <DetailList
            items={[
              { key: 'claim', label: t('actions.column.claim'), value: detail.subject_id },
              {
                key: 'owner',
                label: t('actions.column.owner'),
                value:
                  detail.assigned_to === null
                    ? t('actions.unassigned')
                    : userName(detail.assigned_to),
              },
              {
                key: 'status',
                label: t('actions.column.status'),
                value: statusLabel(detail.status),
              },
              { key: 'notes', label: t('actions.column.notes'), value: detail.note },
            ]}
          />
          <TaskAuditTimeline task={detail} userName={userName} />
        </Dialog>
      )}
    </div>
  );
}
