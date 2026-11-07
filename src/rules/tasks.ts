/** Task rules: when a follow-up task is late. */
import { dateOf } from '../contracts/index.js';
import type { Task } from '../contracts/index.js';

/** A task is overdue when it is not done and its due date (in Africa/Gaborone) is before the as-of date; one with no due date is never overdue. */
export function isTaskOverdue(task: Pick<Task, 'status' | 'due_at'>, asOf: string): boolean {
  return task.status !== 'DONE' && task.due_at !== null && dateOf(task.due_at) < asOf;
}
