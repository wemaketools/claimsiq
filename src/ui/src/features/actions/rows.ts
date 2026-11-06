/** The rows of the Action Queue: the tasks joined to the claim's flags and the owner's name, in queue order, and as CSV. */
import { TASK_PRIORITIES } from '../../../../contracts/index';
import type { ClaimFacts, TaskListItem } from '../../../../contracts/index';
import type { DataTableSort } from '../../components/ui';
import { t } from '../../lib/i18n';
import { claimReasons, formatMoment } from '../claim-scope';
import { priorityLabel, statusLabel } from '../claim-tasks';

export interface QueueRow {
  readonly id: string;
  readonly task: TaskListItem;
  /** The claim the task is on, or `null` for a task on something else. */
  readonly claim: string | null;
  /** The reasons the claim is flagged (labels); empty when it is not, `null` while the flags are not known. */
  readonly issue: readonly string[] | null;
  /** The owner's name, or `null` when the task has no owner. */
  readonly owner: string | null;
}

export function queueRows(
  tasks: readonly TaskListItem[],
  facts: readonly ClaimFacts[] | undefined,
  userName: (userId: string) => string,
): QueueRow[] {
  const factOf = new Map((facts ?? []).map((fact) => [fact.claim_id, fact]));
  return tasks.map((task) => {
    const claim = task.subject_type === 'CLAIM' ? task.subject_id : null;
    const fact = claim === null ? undefined : factOf.get(claim);
    return {
      id: task.task_id,
      task,
      claim,
      issue:
        claim === null
          ? []
          : facts === undefined
            ? null
            : fact === undefined
              ? []
              : claimReasons(fact).map((reason) => reason.label),
      owner: task.assigned_to === null ? null : userName(task.assigned_to),
    };
  });
}

export interface QueueFilter {
  readonly status: string;
  readonly owner: string;
  readonly priority: string;
}
export const NO_OWNER = '__none';

export function filterRows(rows: readonly QueueRow[], filter: QueueFilter): QueueRow[] {
  return rows.filter(
    ({ task }) =>
      (filter.status === '' || task.status === filter.status) &&
      (filter.priority === '' || task.priority === filter.priority) &&
      (filter.owner === '' ||
        (filter.owner === NO_OWNER
          ? task.assigned_to === null
          : task.assigned_to === filter.owner)),
  );
}

const byId = (a: QueueRow, b: QueueRow): number =>
  a.id.localeCompare(b.id, 'en', { numeric: true });
const priorityRank = (row: QueueRow): number => TASK_PRIORITIES.indexOf(row.task.priority);
const dueTime = (row: QueueRow): number =>
  row.task.due_at === null ? Number.POSITIVE_INFINITY : Date.parse(row.task.due_at.slice(0, 10));

/** The queue's own order: overdue first, then the higher priority, then the earlier due date (none last), then task number. */
function queueOrder(a: QueueRow, b: QueueRow): number {
  return (
    Number(b.task.overdue) - Number(a.task.overdue) ||
    priorityRank(b) - priorityRank(a) ||
    (dueTime(a) === dueTime(b) ? 0 : dueTime(a) < dueTime(b) ? -1 : 1) ||
    byId(a, b)
  );
}

export const QUEUE_SORT: DataTableSort = { key: 'queue', dir: 'asc' };

function compareBy(key: string, a: QueueRow, b: QueueRow): number {
  switch (key) {
    case 'claim':
      return (a.claim ?? '').localeCompare(b.claim ?? '', 'en', { numeric: true });
    case 'owner':
      return (a.owner ?? '').localeCompare(b.owner ?? '');
    case 'due':
      return dueTime(a) === dueTime(b) ? 0 : dueTime(a) < dueTime(b) ? -1 : 1;
    case 'priority':
      return priorityRank(a) - priorityRank(b);
    case 'status':
      return a.task.status.localeCompare(b.task.status);
    case 'updated':
      return Date.parse(a.task.updated_at) - Date.parse(b.task.updated_at);
    default:
      return queueOrder(a, b);
  }
}

/** The default order, or a chosen column with the queue order breaking ties, so the screen and the CSV agree. */
export function sortRows(rows: readonly QueueRow[], sort: DataTableSort): QueueRow[] {
  const direction = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => direction * compareBy(sort.key, a, b) || queueOrder(a, b));
}

/** Header row first. An empty cell is a value the task does not have. */
export function queueTable(rows: readonly QueueRow[]): string[][] {
  return [
    [
      t('actions.csv.task'),
      t('actions.csv.claim'),
      t('actions.column.issue'),
      t('actions.column.owner'),
      t('actions.column.due'),
      t('actions.csv.overdue'),
      t('actions.column.priority'),
      t('actions.column.status'),
      t('actions.column.updated'),
      t('actions.column.notes'),
    ],
    ...rows.map(({ task, ...row }) => [
      task.task_id,
      row.claim ?? '',
      (row.issue ?? []).join('; '),
      row.owner ?? '',
      task.due_at === null ? '' : formatMoment(task.due_at),
      task.overdue ? t('actions.csv.yes') : t('actions.csv.no'),
      priorityLabel(task.priority),
      statusLabel(task.status),
      formatMoment(task.updated_at),
      task.note ?? '',
    ]),
  ];
}
