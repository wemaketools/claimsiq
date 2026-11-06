/** The follow-up tasks of a claim, each with its audit trail: who changed what, and when. */
import { useState } from 'react';

import type { TaskRecord } from '../../../../contracts/index';
import type { QueryResult } from '../../api/hooks';
import { Button, Card, Chip, EmptyState, ErrorState, SkeletonBlock } from '../../components/ui';
import { t } from '../../lib/i18n';
import { formatMoment } from '../claim-scope';
import {
  AssignTaskDialog,
  SetTaskStatusDialog,
  TaskAuditTimeline,
  TaskStatusChip,
  priorityLabel,
} from '../claim-tasks';
import type { ClaimNames } from './names';

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
  const [assigning, setAssigning] = useState<TaskRecord | null>(null);
  const [changing, setChanging] = useState<TaskRecord | null>(null);
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
                <TaskStatusChip status={task.status} />
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
              <div className="ciq-inline">
                <Button
                  size="sm"
                  aria-label={t('claim-tasks.assign.buttonFor', { task: task.task_id })}
                  onClick={() => setAssigning(task)}
                >
                  {t('claim-tasks.assign.button')}
                </Button>
                <Button
                  size="sm"
                  aria-label={t('claim-tasks.status.buttonFor', { task: task.task_id })}
                  onClick={() => setChanging(task)}
                >
                  {t('claim-tasks.status.button')}
                </Button>
              </div>
              <TaskAuditTimeline task={task} userName={names.user} />
            </li>
          ))}
        </ul>
      )}
      {assigning !== null && (
        <AssignTaskDialog task={assigning} onClose={() => setAssigning(null)} />
      )}
      {changing !== null && (
        <SetTaskStatusDialog task={changing} onClose={() => setChanging(null)} />
      )}
    </Card>
  );
}
