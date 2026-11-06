/**
 * What creating a task, assigning it and changing its status do to a `TaskRecord`, audit entry included. The mock API
 * keeps the result in browser storage and the server writes it to the database, so both apply the same rules.
 */
import type { z } from 'zod';

import { TASK_STATUS_TRANSITIONS } from '../contracts/index.js';
import type { CreateTaskBody, PersonaId, TaskAuditEntry, TaskRecord, TaskStatus } from '../contracts/index.js';

/** A change the task rules refuse; `field` names the input at fault, for the 422 answer. */
export class TaskRuleViolation extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'TaskRuleViolation';
    this.field = field;
  }
}

export const taskIdOf = (number: number): string => `TASK-${String(number).padStart(4, '0')}`;

export interface TaskChangeContext {
  readonly actor: PersonaId;
  /** The instant of the change, `instantOf(now)`. */
  readonly at: string;
}

function audited(task: TaskRecord, entry: Omit<TaskAuditEntry, 'task_id' | 'at' | 'actor'>, context: TaskChangeContext): TaskRecord {
  return { ...task, audit: [...task.audit, { task_id: task.task_id, at: context.at, actor: context.actor, ...entry }] };
}

export function createdTask(
  tenantId: string,
  taskId: string,
  body: z.output<typeof CreateTaskBody>,
  context: TaskChangeContext,
): TaskRecord {
  return audited(
    {
      tenant_id: tenantId,
      task_id: taskId,
      module: body.module,
      subject_type: body.subject_type,
      subject_id: body.subject_id,
      assigned_to: body.assigned_to,
      due_at: body.due_at,
      priority: body.priority,
      status: 'OPEN',
      note: body.note,
      updated_at: context.at,
      audit: [],
    },
    { action: 'CREATED', from: null, to: 'OPEN', note: body.note },
    context,
  );
}

/** The task with its new assignee and one audit entry; the same object when nothing changes. */
export function assignedTask(task: TaskRecord, assignedTo: string, context: TaskChangeContext): TaskRecord {
  if (task.assigned_to === assignedTo) {
    return task;
  }
  return audited(
    { ...task, assigned_to: assignedTo, updated_at: context.at },
    { action: 'ASSIGNED', from: task.assigned_to, to: assignedTo, note: null },
    context,
  );
}

/** The task with its new status and one audit entry; the same object when nothing changes. */
export function taskWithStatus(task: TaskRecord, status: TaskStatus, note: string | null, context: TaskChangeContext): TaskRecord {
  if (task.status === status) {
    return task;
  }
  if (!TASK_STATUS_TRANSITIONS[task.status].includes(status)) {
    throw new TaskRuleViolation('status', `A task that is ${task.status} cannot become ${status}.`);
  }
  return audited(
    { ...task, status, updated_at: context.at },
    { action: 'STATUS_CHANGED', from: task.status, to: status, note },
    context,
  );
}
