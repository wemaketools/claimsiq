/** "Create follow-up task": opens a claim task through the typed endpoint, confirmed with who, what and the result. Given no claim, it asks which one. */
import { useState } from 'react';

import { TASK_PRIORITIES, endpoints } from '../../../../contracts/index';
import type { TaskPriority } from '../../../../contracts/index';
import { isApiError } from '../../api/client';
import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../api/hooks';
import { ConfirmActionDialog, DateInput, Select, useToast } from '../../components/ui';
import { t } from '../../lib/i18n';
import { priorityLabel } from './labels';

export interface CreateTaskDialogProps {
  /** The claim the task is for; `null` lets the user choose it (the Action Queue has no claim of its own). */
  readonly claimId: string | null;
  readonly defaultPriority: TaskPriority;
  readonly onClose: () => void;
}

/** Mount it while it is open: every opening starts with empty fields. */
export function CreateTaskDialog({ claimId, defaultPriority, onClose }: CreateTaskDialogProps) {
  const toast = useToast();
  const users = useApiQuery(endpoints.usersList, {});
  const claims = useApiQuery(endpoints.claimsList, claimId === null ? {} : null);
  const [chosen, setChosen] = useState('');
  const claim = claimId ?? chosen;
  const create = useApiMutation(endpoints.tasksCreate);
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(defaultPriority);
  const [due, setDue] = useState('');

  return (
    <ConfirmActionDialog
      open
      size="lg"
      title={t('claim-tasks.create.title')}
      scope={
        claim === ''
          ? t('claim-tasks.create.scopeNoClaim')
          : t('claim-tasks.create.scope', { claim })
      }
      confirmDisabled={claim === ''}
      consequence={t('claim-tasks.create.consequence')}
      confirmLabel={t('claim-tasks.create.confirm')}
      reason={{
        label: t('claim-tasks.create.nextAction'),
        hint: t('claim-tasks.create.nextActionHint'),
        required: true,
      }}
      pending={create.pending}
      error={create.error}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          const task = await create.mutate({
            body: {
              subject_type: 'CLAIM',
              subject_id: claim,
              assigned_to: assignee === '' ? null : assignee,
              due_at: due === '' ? null : due,
              priority,
              note: reason,
            },
          });
          invalidateApiQueries('tasks.');
          toast.show(t('claim-tasks.create.created', { task: task.task_id, claim }), 'success');
          onClose();
        } catch (caught) {
          // The mutation keeps the problem and the dialog shows it; anything else is a bug worth seeing.
          if (!isApiError(caught)) throw caught;
        }
      }}
    >
      {claimId === null && (
        <Select
          label={t('claim-tasks.create.claim')}
          placeholder={t('claim-tasks.create.chooseClaim')}
          required
          loading={claims.status === 'loading'}
          value={chosen}
          hint={claims.error === null ? undefined : t('claim-tasks.create.claimsFailed')}
          options={(claims.data?.items ?? [])
            .map((item) => ({ value: item.claim_id, label: item.claim_id }))
            .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))}
          onChange={setChosen}
        />
      )}
      <Select
        label={t('claim-tasks.create.assignee')}
        placeholder={t('claim-tasks.create.unassigned')}
        loading={users.status === 'loading'}
        value={assignee}
        options={(users.data?.items ?? []).map((user) => ({
          value: user.user_id,
          label: user.display_name,
        }))}
        onChange={setAssignee}
      />
      <Select
        label={t('claim-tasks.create.priority')}
        value={priority}
        options={TASK_PRIORITIES.map((value) => ({ value, label: priorityLabel(value) }))}
        onChange={(value) => setPriority(TASK_PRIORITIES.find((p) => p === value) ?? priority)}
      />
      <DateInput label={t('claim-tasks.create.due')} value={due} onChange={setDue} />
    </ConfirmActionDialog>
  );
}
