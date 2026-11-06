/**
 * The task commands: create, assign and change status. Each runs in one `withTenant` transaction, applies the shared
 * task rules (`src/read-model/taskRules.ts`, the mock API's too) and writes the changed row and its audit entry together.
 * The audit entry's actor is the persona acting (`X-Persona`); the signed-in account is recorded beside it.
 */
import { sql } from 'kysely';

import { PERSONA_HEADER, instantOf } from '../../../contracts/index.js';
import type { PersonaId, TaskRecord } from '../../../contracts/index.js';
import { assignedTask, createdTask, taskWithStatus, within } from '../../../read-model/index.js';
import type { TenantScope } from '../../lib/db/index.js';
import { HttpProblem } from '../../lib/errors/index.js';
import { loadAuditRows, taskRecord } from '../../lib/read-model/load.js';
import type { HandlersOf, RequestContext } from '../../lib/router/contract.js';

function requireActor(actor: PersonaId | null): PersonaId {
  if (actor === null) {
    throw new HttpProblem(400, `${PERSONA_HEADER} must name the persona acting.`);
  }
  return actor;
}

const invalid = (field: string, message: string): HttpProblem =>
  new HttpProblem(422, 'The request has invalid values.', [{ field, code: 'invalid', message }]);

async function requireUser(scope: TenantScope, field: string, userId: string): Promise<void> {
  const found = await scope.selectFrom('users').select('user_id').where('user_id', '=', userId).executeTakeFirst();
  if (found === undefined) {
    throw invalid(field, `User "${userId}" does not exist in this data set.`);
  }
}

async function subjectExists(scope: TenantScope, asOf: string, type: string, id: string): Promise<boolean> {
  switch (type) {
    case 'CLAIM': {
      const claim = await scope.selectFrom('claims').select('reported_at').where('claim_id', '=', id).executeTakeFirst();
      return claim !== undefined && within(asOf, claim.reported_at);
    }
    case 'POLICY':
      return (await scope.selectFrom('policies').select('policy_id').where('policy_id', '=', id).executeTakeFirst()) !== undefined;
    case 'INVOICE':
      return (await scope.selectFrom('invoices').select('invoice_id').where('invoice_id', '=', id).executeTakeFirst()) !== undefined;
    default:
      return (await scope.selectFrom('suppliers').select('supplier_id').where('supplier_id', '=', id).executeTakeFirst()) !== undefined;
  }
}

async function findTask(scope: TenantScope, taskId: string, lock: boolean): Promise<TaskRecord> {
  const query = scope.selectFrom('tasks').selectAll().where('task_id', '=', taskId);
  const row = await (lock ? query.forUpdate() : query).executeTakeFirst();
  if (row === undefined) {
    throw new HttpProblem(404, `Task "${taskId}" does not exist.`);
  }
  return taskRecord(row, await loadAuditRows(scope, taskId));
}

async function saveAuditEntry(scope: TenantScope, task: TaskRecord, ctx: RequestContext<unknown, unknown>): Promise<void> {
  const entry = task.audit.at(-1);
  if (entry === undefined) {
    throw new Error(`Task ${task.task_id} changed without an audit entry.`);
  }
  await scope
    .insertInto('task_audit_entries', {
      task_id: entry.task_id,
      at: ctx.now,
      actor: entry.actor,
      action: entry.action,
      from_value: entry.from,
      to_value: entry.to,
      note: entry.note,
      actor_user_id: ctx.session.authUserId,
    })
    .execute();
}

export const taskHandlers: HandlersOf<'tasksCreate' | 'tasksAssign' | 'tasksSetStatus'> = {
  tasksCreate: {
    status: 201,
    run: async (ctx) => {
      const actor = requireActor(ctx.actor);
      return await ctx.tenant(async (scope) => {
        if (ctx.idempotencyKey !== null) {
          // Serializes two creates with the same key, so the second finds the first's task instead of failing on the unique key.
          await sql`select pg_advisory_xact_lock(hashtext(${`${scope.tenantId}:${ctx.idempotencyKey}`}))`.execute(scope.db);
          const earlier = await scope.selectFrom('tasks').select('task_id').where('idempotency_key', '=', ctx.idempotencyKey).executeTakeFirst();
          if (earlier !== undefined) {
            return await findTask(scope, earlier.task_id, false);
          }
        }
        const { subject_type, subject_id, assigned_to } = ctx.body;
        if (!(await subjectExists(scope, ctx.asOf, subject_type, subject_id))) {
          throw invalid('subject_id', `${subject_type.toLowerCase()} "${subject_id}" does not exist in this data set as of ${ctx.asOf}.`);
        }
        if (assigned_to !== null) {
          await requireUser(scope, 'assigned_to', assigned_to);
        }
        const issued = await sql<{ task_id: string }>`select next_task_id(${scope.tenantId}) as task_id`.execute(scope.db);
        const taskId = issued.rows[0]?.task_id;
        if (taskId === undefined) {
          throw new Error('next_task_id returned no id.');
        }
        const created = createdTask(scope.tenantId, taskId, ctx.body, { actor, at: instantOf(ctx.now) });
        await scope
          .insertInto('tasks', {
            task_id: created.task_id,
            module: created.module,
            subject_type: created.subject_type,
            subject_id: created.subject_id,
            assigned_to: created.assigned_to,
            due_at: created.due_at,
            priority: created.priority,
            status: created.status,
            note: created.note,
            updated_at: ctx.now,
            idempotency_key: ctx.idempotencyKey,
          })
          .execute();
        await saveAuditEntry(scope, created, ctx);
        return created;
      });
    },
  },

  tasksAssign: {
    run: async (ctx) => {
      const actor = requireActor(ctx.actor);
      return await ctx.tenant(async (scope) => {
        const task = await findTask(scope, ctx.params.taskId ?? '', true);
        await requireUser(scope, 'assigned_to', ctx.body.assigned_to);
        const updated = assignedTask(task, ctx.body.assigned_to, { actor, at: instantOf(ctx.now) });
        if (updated === task) {
          return task;
        }
        await scope.updateTable('tasks').set({ assigned_to: updated.assigned_to, updated_at: ctx.now }).where('task_id', '=', task.task_id).execute();
        await saveAuditEntry(scope, updated, ctx);
        return updated;
      });
    },
  },

  tasksSetStatus: {
    run: async (ctx) => {
      const actor = requireActor(ctx.actor);
      return await ctx.tenant(async (scope) => {
        const task = await findTask(scope, ctx.params.taskId ?? '', true);
        const updated = taskWithStatus(task, ctx.body.status, ctx.body.note, { actor, at: instantOf(ctx.now) });
        if (updated === task) {
          return task;
        }
        await scope.updateTable('tasks').set({ status: updated.status, updated_at: ctx.now }).where('task_id', '=', task.task_id).execute();
        await saveAuditEntry(scope, updated, ctx);
        return updated;
      });
    },
  },
};

