/** How a task reads wherever it shows: its status chip and its audit trail. */
import type { TaskRecord } from '../../../../contracts/index';
import { Chip, Timeline } from '../../components/ui';
import type { ChipTone, TimelineItem } from '../../components/ui';
import { t } from '../../lib/i18n';
import { formatMoment } from '../claim-scope';
import { statusLabel } from './labels';

const STATUS_TONE = {
  OPEN: 'info',
  IN_PROGRESS: 'accent',
  DONE: 'success',
} as const satisfies Record<TaskRecord['status'], ChipTone>;

export function TaskStatusChip({ status }: { readonly status: TaskRecord['status'] }) {
  return (
    <Chip tone={STATUS_TONE[status]} size="sm">
      {statusLabel(status)}
    </Chip>
  );
}

function statusOf(value: string | null): TaskRecord['status'] {
  return value === 'IN_PROGRESS' || value === 'DONE' ? value : 'OPEN';
}

/** Who did what and when, oldest first; the actor is the persona that made the change. */
export function TaskAuditTimeline({
  task,
  userName,
}: {
  readonly task: TaskRecord;
  readonly userName: (userId: string) => string;
}) {
  const person = (id: string | null): string =>
    id === null ? t('claim-tasks.audit.unassignedFrom') : userName(id);
  const items: TimelineItem[] = task.audit.map((entry, index) => ({
    id: `${task.task_id}-${index}`,
    title:
      entry.action === 'CREATED'
        ? t('claim-tasks.audit.CREATED', { to: statusLabel('OPEN') })
        : entry.action === 'ASSIGNED'
          ? t('claim-tasks.audit.ASSIGNED', { to: person(entry.to) })
          : t('claim-tasks.audit.STATUS_CHANGED', {
              from: statusLabel(statusOf(entry.from)),
              to: statusLabel(statusOf(entry.to)),
            }),
    meta: t('claim-tasks.audit.by', {
      actor: t(`shell.persona.${entry.actor}`),
      time: formatMoment(entry.at),
    }),
    detail: entry.note === null ? undefined : t('claim-tasks.audit.note', { note: entry.note }),
  }));
  return <Timeline items={items} label={t('claim-tasks.audit.title', { task: task.task_id })} />;
}
