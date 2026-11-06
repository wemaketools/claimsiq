/** The follow-up tasks of a claim, each with its audit trail: who changed what, and when. */
import type { TaskRecord } from '../../../../contracts/index';
import type { QueryResult } from '../../api/hooks';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  SkeletonBlock,
  Timeline,
} from '../../components/ui';
import type { ChipTone, TimelineItem } from '../../components/ui';
import { t } from '../../lib/i18n';
import { formatMoment } from '../claim-scope';
import { priorityLabel, statusLabel } from '../claim-tasks';
import type { ClaimNames } from './names';

const STATUS_TONE = {
  OPEN: 'info',
  IN_PROGRESS: 'accent',
  DONE: 'success',
} as const satisfies Record<TaskRecord['status'], ChipTone>;

function taskStatusOf(value: string | null): TaskRecord['status'] {
  return value === 'IN_PROGRESS' || value === 'DONE' ? value : 'OPEN';
}

function auditItems(task: TaskRecord, names: ClaimNames): TimelineItem[] {
  const person = (id: string | null): string =>
    id === null ? t('claim-detail.tasks.audit.unassignedFrom') : names.user(id);
  return task.audit.map((entry, index) => ({
    id: `${task.task_id}-${index}`,
    title:
      entry.action === 'CREATED'
        ? t('claim-detail.tasks.audit.CREATED', { to: statusLabel('OPEN') })
        : entry.action === 'ASSIGNED'
          ? t('claim-detail.tasks.audit.ASSIGNED', { to: person(entry.to) })
          : t('claim-detail.tasks.audit.STATUS_CHANGED', {
              from: statusLabel(taskStatusOf(entry.from)),
              to: statusLabel(taskStatusOf(entry.to)),
            }),
    meta: t('claim-detail.tasks.audit.by', {
      actor: t(`shell.persona.${entry.actor}`),
      time: formatMoment(entry.at),
    }),
    detail:
      entry.note === null ? undefined : t('claim-detail.tasks.audit.note', { note: entry.note }),
  }));
}

export function TasksCard({
  tasks,
  names,
  onCreate,
}: {
  readonly tasks: QueryResult<{ readonly items: readonly TaskRecord[] }>;
  readonly names: ClaimNames;
  readonly onCreate: () => void;
}) {
  const items = [...(tasks.data?.items ?? [])].sort((a, b) => a.task_id.localeCompare(b.task_id));
  return (
    <Card
      title={t('claim-detail.tasks.title')}
      subtitle={t('claim-detail.tasks.subtitle')}
      actions={
        <Button size="sm" icon="plus" onClick={onCreate}>
          {t('claim-tasks.create.button')}
        </Button>
      }
    >
      {tasks.data === undefined ? (
        tasks.error === null ? (
          <SkeletonBlock lines={3} />
        ) : (
          <ErrorState
            error={tasks.error}
            onRetry={tasks.reload}
            title={t('claim-detail.tasks.failed')}
          />
        )
      ) : items.length === 0 ? (
        <EmptyState compact icon="listChecks" title={t('claim-detail.tasks.empty')} />
      ) : (
        <ul className="ciq-list-plain">
          {items.map((task) => (
            <li key={task.task_id}>
              <div className="ciq-inline">
                <strong className="ciq-mono">{task.task_id}</strong>
                <Chip tone={STATUS_TONE[task.status]} size="sm">
                  {statusLabel(task.status)}
                </Chip>
                <Chip tone="neutral-outlined" size="sm">
                  {t('claim-detail.tasks.priority', { priority: priorityLabel(task.priority) })}
                </Chip>
              </div>
              {task.note !== null && <p>{task.note}</p>}
              <p className="ciq-text-muted">
                {t('claim-detail.tasks.assignee')}:{' '}
                {task.assigned_to === null
                  ? t('claim-detail.tasks.unassigned')
                  : names.user(task.assigned_to)}
                {' · '}
                {t('claim-detail.tasks.due')}:{' '}
                {task.due_at === null ? t('claim-detail.tasks.noDue') : formatMoment(task.due_at)}
              </p>
              <Timeline
                items={auditItems(task, names)}
                label={t('claim-detail.tasks.history', { task: task.task_id })}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
