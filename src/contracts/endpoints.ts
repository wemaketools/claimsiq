/**
 * The typed endpoints of the API, shared by the SPA (which calls them), the mock API (which implements them in the
 * browser for Stage A) and the backend later. Reads return raw records of the active tenant as of the as-of date;
 * metrics and rules are not computed here.
 *
 * Request context travels in headers: `X-Tenant-Id`, `X-As-Of` (a date, default 2026-10-21) and, on commands,
 * `X-Persona` (the actor).
 */
import { z } from 'zod';

import { PersonaId } from './personas.js';
import { DateOnly, Id, Instant, Moment, Text } from './primitives.js';
import {
  Broker,
  Claim,
  ClaimEvent,
  ClaimPayment,
  Client,
  Invoice,
  PaymentAllocation,
  PaymentAttempt,
  Policy,
  Product,
  Receipt,
  ReserveEvent,
  Supplier,
  SupplierRequest,
  Task,
  TaskModule,
  TaskPriority,
  TaskStatus,
  TaskSubjectType,
  User,
} from './entities.js';

export const TENANT_HEADER = 'X-Tenant-Id';
export const AS_OF_HEADER = 'X-As-Of';
export const PERSONA_HEADER = 'X-Persona';

export interface EndpointContract<R, Q = undefined, B = undefined> {
  /** Unique and stable: the SPA's cache keys match on it, for example `claims.list`. */
  readonly id: string;
  readonly method: 'GET' | 'POST';
  /** Absolute path; `:name` segments are path parameters. */
  readonly path: string;
  readonly response: z.ZodType<R>;
  readonly query: z.ZodType<Q> | null;
  readonly body: z.ZodType<B> | null;
  readonly idempotent?: boolean;
}

function endpoint<R, Q = undefined, B = undefined>(
  spec: Omit<EndpointContract<R, Q, B>, 'query' | 'body'> & {
    readonly query?: z.ZodType<Q>;
    readonly body?: z.ZodType<B>;
  },
): EndpointContract<R, Q, B> {
  const { query, body, ...rest } = spec;
  return { ...rest, query: query ?? null, body: body ?? null };
}

const API = '/api/v1';

const readContext = { tenant_id: Id, as_of: DateOnly };
const collection = <T extends z.ZodType>(item: T) => z.object({ ...readContext, items: z.array(item) });

export const TaskAuditEntry = z.object({
  task_id: Id,
  at: Instant,
  actor: PersonaId,
  action: z.enum(['CREATED', 'ASSIGNED', 'STATUS_CHANGED']),
  from: z.string().nullable(),
  to: z.string().nullable(),
  note: z.string().nullable(),
});
export type TaskAuditEntry = z.infer<typeof TaskAuditEntry>;

export const ClaimRecord = Claim.extend({
  events: z.array(ClaimEvent),
  reserve_events: z.array(ReserveEvent),
  payments: z.array(ClaimPayment),
  supplier_requests: z.array(SupplierRequest),
});
export type ClaimRecord = z.infer<typeof ClaimRecord>;

export const InvoiceRecord = Invoice.extend({
  allocations: z.array(PaymentAllocation),
  receipts: z.array(Receipt),
  payment_attempts: z.array(PaymentAttempt),
});
export type InvoiceRecord = z.infer<typeof InvoiceRecord>;

export const TaskRecord = Task.extend({ audit: z.array(TaskAuditEntry) });
export type TaskRecord = z.infer<typeof TaskRecord>;

export const DataIssue = z.object({
  /** `quarantined`: the row was rejected. `warning`: the row loaded, but evidence it should carry is missing. */
  kind: z.enum(['quarantined', 'warning']),
  entity: Text,
  file: Text,
  /** The line in the file, counting the header as line 1. */
  row: z.number().int().min(1),
  record_id: z.string().nullable(),
  field: Text,
  problem: Text,
  fix: Text,
});
export type DataIssue = z.infer<typeof DataIssue>;

export const TaskQuery = z.object({
  subject_type: TaskSubjectType.optional(),
  subject_id: Id.optional(),
  assigned_to: Id.optional(),
  status: TaskStatus.optional(),
});
export type TaskQuery = z.infer<typeof TaskQuery>;

export const CreateTaskBody = z.object({
  module: TaskModule.default('CLAIMS'),
  subject_type: TaskSubjectType,
  subject_id: Id,
  assigned_to: Id.nullable().default(null),
  due_at: Moment.nullable().default(null),
  priority: TaskPriority.default('MEDIUM'),
  note: z.string().trim().min(1).nullable().default(null),
});
export type CreateTaskBody = z.input<typeof CreateTaskBody>;

export const AssignTaskBody = z.object({ assigned_to: Id });
export type AssignTaskBody = z.infer<typeof AssignTaskBody>;

export const SetTaskStatusBody = z.object({
  status: TaskStatus,
  note: z.string().trim().min(1).nullable().default(null),
});
export type SetTaskStatusBody = z.input<typeof SetTaskStatusBody>;

export const endpoints = {
  claimsList: endpoint({
    id: 'claims.list',
    method: 'GET',
    path: `${API}/claims`,
    response: collection(ClaimRecord),
  }),
  claimsGet: endpoint({
    id: 'claims.get',
    method: 'GET',
    path: `${API}/claims/:claimId`,
    response: z.object({ ...readContext, item: ClaimRecord }),
  }),
  policiesList: endpoint({ id: 'policies.list', method: 'GET', path: `${API}/policies`, response: collection(Policy) }),
  clientsList: endpoint({ id: 'clients.list', method: 'GET', path: `${API}/clients`, response: collection(Client) }),
  brokersList: endpoint({ id: 'brokers.list', method: 'GET', path: `${API}/brokers`, response: collection(Broker) }),
  productsList: endpoint({ id: 'products.list', method: 'GET', path: `${API}/products`, response: collection(Product) }),
  invoicesList: endpoint({
    id: 'invoices.list',
    method: 'GET',
    path: `${API}/invoices`,
    response: collection(InvoiceRecord),
  }),
  suppliersList: endpoint({ id: 'suppliers.list', method: 'GET', path: `${API}/suppliers`, response: collection(Supplier) }),
  usersList: endpoint({ id: 'users.list', method: 'GET', path: `${API}/users`, response: collection(User) }),
  tasksList: endpoint({
    id: 'tasks.list',
    method: 'GET',
    path: `${API}/tasks`,
    query: TaskQuery,
    response: collection(TaskRecord),
  }),
  tasksCreate: endpoint({
    id: 'tasks.create',
    method: 'POST',
    path: `${API}/tasks`,
    idempotent: true,
    body: CreateTaskBody,
    response: TaskRecord,
  }),
  tasksAssign: endpoint({
    id: 'tasks.assign',
    method: 'POST',
    path: `${API}/tasks/:taskId/assign`,
    body: AssignTaskBody,
    response: TaskRecord,
  }),
  tasksSetStatus: endpoint({
    id: 'tasks.setStatus',
    method: 'POST',
    path: `${API}/tasks/:taskId/status`,
    body: SetTaskStatusBody,
    response: TaskRecord,
  }),
  dataIssues: endpoint({
    id: 'data.issues',
    method: 'GET',
    path: `${API}/data/issues`,
    response: z.object({ tenant_id: Id, quarantined_rows: z.number().int().min(0), issues: z.array(DataIssue) }),
  }),
  /** Throws away the changes made on top of the active tenant's fixture. */
  demoReset: endpoint({
    id: 'demo.reset',
    method: 'POST',
    path: `${API}/demo/reset`,
    response: z.object({ tenant_id: Id, reset: z.literal(true) }),
  }),
} as const;

export type Endpoints = typeof endpoints;
