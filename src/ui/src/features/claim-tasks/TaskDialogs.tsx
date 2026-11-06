/** "Assign owner" and "Change status": each confirmed in a dialog and logged by the API with the active persona and the time. */
import { useState } from 'react';

import { TASK_STATUS_TRANSITIONS, endpoints } from '../../../../contracts/index';
import type { TaskRecord, TaskStatus } from '../../../../contracts/index';
import { isApiError } from '../../api/client';
import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../api/hooks';
import { ConfirmActionDialog, Select, useToast } from '../../components/ui';
import { t } from '../../lib/i18n';
import { statusLabel } from './labels';

interface TaskDialogProps {
  readonly task: TaskRecord;
  readonly onClose: () => void;
}

/** Mount it while it is open: every opening starts with empty fields. */
export function AssignTaskDialog({ task, onClose }: TaskDialogProps) {
  const toast = useToast();
  const users = useApiQuery(endpoints.usersList, {});
  const assign = useApiMutation(endpoints.tasksAssign);
  const [owner, setOwner] = useState('');
  const people = users.data?.items ?? [];

  return (
    <ConfirmActionDialog
      open
      title={t('claim-tasks.assign.title')}
      scope={t('claim-tasks.assign.scope', { task: task.task_id, claim: task.subject_id })}
      consequence={t('claim-tasks.assign.consequence')}
      confirmLabel={t('claim-tasks.assign.confirm')}
      confirmDisabled={owner === ''}
      pending={assign.pending}
      error={assign.error}
      onCancel={onClose}
      onConfirm={async () => {
        try {
          await assign.mutate({ params: { taskId: task.task_id }, body: { assigned_to: owner } });
          invalidateApiQueries('tasks.');
          toast.show(
            t('claim-tasks.assign.done', {
              task: task.task_id,
              owner: people.find((user) => user.user_id === owner)?.display_name ?? owner,
            }),
            'success',
          );
          onClose();
        } catch (caught) {
          if (!isApiError(caught)) throw caught;
        }
      }}
    >
      <Select
        label={t('claim-tasks.assign.owner')}
        placeholder={t('claim-tasks.assign.choose')}
        required
        loading={users.status === 'loading'}
        value={owner}
        options={people.map((user) => ({ value: user.user_id, label: user.display_name }))}
        onChange={setOwner}
      />
    </ConfirmActionDialog>
  );
}

/** The statuses the task may move to are the contract's transitions, so the API and the dialog agree. */
export function SetTaskStatusDialog({ task, onClose }: TaskDialogProps) {
  const toast = useToast();
  const setStatus = useApiMutation(endpoints.tasksSetStatus);
  const next = TASK_STATUS_TRANSITIONS[task.status];
  const [status, setChosen] = useState<TaskStatus | ''>('');

  return (
    <ConfirmActionDialog
      open
      title={t('claim-tasks.status.title')}
      scope={t('claim-tasks.status.scope', {
        task: task.task_id,
        claim: task.subject_id,
        status: statusLabel(task.status),
      })}
      consequence={t('claim-tasks.status.consequence')}
      confirmLabel={t('claim-tasks.status.confirm')}
      confirmDisabled={status === ''}
      reason={{
        label: t('claim-tasks.status.note'),
        hint: t('claim-tasks.status.noteHint'),
        required: false,
      }}
      pending={setStatus.pending}
      error={setStatus.error}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        if (status === '') return;
        try {
          await setStatus.mutate({
            params: { taskId: task.task_id },
            body: { status, note: reason === '' ? null : reason },
          });
          invalidateApiQueries('tasks.');
          toast.show(
            t('claim-tasks.status.done', { task: task.task_id, status: statusLabel(status) }),
            'success',
          );
          onClose();
        } catch (caught) {
          if (!isApiError(caught)) throw caught;
        }
      }}
    >
      <Select
        label={t('claim-tasks.status.next')}
        placeholder={t('claim-tasks.status.choose')}
        required
        value={status}
        options={next.map((value) => ({ value, label: statusLabel(value) }))}
        onChange={(value) => setChosen(next.find((candidate) => candidate === value) ?? '')}
      />
    </ConfirmActionDialog>
  );
}
