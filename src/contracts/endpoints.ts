/**
 * The typed endpoints of the API, shared by the SPA (which calls them), the mock API (which implements them in the
 * browser for the prototype build) and the server (`/api/v1`, from the database). Reads return raw records of the active tenant, limited by the as-of date
 * where the read model (`src/read-model`, which the mock API and the server share) says so; the computed reads are `claims.facts` and `suppliers.insights`, which run the rules engine over those records, and
 * the `overdue` flag of `tasks.list`.
 *
 * Request context travels in headers: `X-Tenant-Id`, `X-As-Of` (a date, default 2026-10-21) and, on commands,
 * `X-Persona` (the actor).
 */
import { z } from 'zod';

import { ClaimBreakdowns, ClaimFacts, ClaimsSummary, PeriodOption } from './facts.js';
import { PersonaId } from './personas.js';
import { DateOnly, Id, Instant, Moment, Text } from './primitives.js';
import { SupplierInsights } from './suppliers.js';
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

/** A task as `tasks.list` serves it: with the engine's judgement whether it is overdue at the as-of date. */
export const TaskListItem = TaskRecord.extend({ overdue: z.boolean() });
export type TaskListItem = z.infer<typeof TaskListItem>;

export const DataIssue = z.object({
  /** Counts from 1 in the order found; unique in a list, so it is the key of a row. */
  issue_no: z.number().int().min(1),
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

/** Narrows the claims `claims.facts` covers (one claim, or by policy, broker, product, handler; the summary is computed over the narrowed set, never over all claims) and names the period window. */
export const ClaimFactsQuery = z.object({
  claim_id: Id.optional(),
  policy_id: Id.optional(),
  broker_id: Id.optional(),
  product_id: Id.optional(),
  handler_id: Id.optional(),
  /** The window of the period figures; the last 30 days when absent. */
  period: PeriodOption.optional(),
});
export type ClaimFactsQuery = z.infer<typeof ClaimFactsQuery>;

/** The claim filters of `suppliers.insights`: the figures cover the open claims these filters leave. */
export const SupplierInsightsQuery = ClaimFactsQuery.pick({
  policy_id: true,
  broker_id: true,
  product_id: true,
  handler_id: true,
});
export type SupplierInsightsQuery = z.infer<typeof SupplierInsightsQuery>;

/** The invoices of one policy; the join is the policy id and never a name. */
export const InvoicesQuery = z.object({ policy_id: Id.optional() });
export type InvoicesQuery = z.infer<typeof InvoicesQuery>;

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
  /** The rules engine's facts for the claims visible at the as-of date (and matching the query), and the totals over them. */
  claimsFacts: endpoint({
    id: 'claims.facts',
    method: 'GET',
    path: `${API}/claim-facts`,
    query: ClaimFactsQuery,
    response: z.object({
      ...readContext,
      items: z.array(ClaimFacts),
      summary: ClaimsSummary,
      breakdowns: ClaimBreakdowns,
    }),
  }),
  policiesList: endpoint({ id: 'policies.list', method: 'GET', path: `${API}/policies`, response: collection(Policy) }),
  clientsList: endpoint({ id: 'clients.list', method: 'GET', path: `${API}/clients`, response: collection(Client) }),
  brokersList: endpoint({ id: 'brokers.list', method: 'GET', path: `${API}/brokers`, response: collection(Broker) }),
  productsList: endpoint({ id: 'products.list', method: 'GET', path: `${API}/products`, response: collection(Product) }),
  invoicesList: endpoint({
    id: 'invoices.list',
    method: 'GET',
    path: `${API}/invoices`,
    query: InvoicesQuery,
    response: collection(InvoiceRecord),
  }),
  suppliersList: endpoint({ id: 'suppliers.list', method: 'GET', path: `${API}/suppliers`, response: collection(Supplier) }),
  /** Each supplier's open requests, waits, breaches, cases, late actions and turnaround over the filtered claims (the rules engine's `summarizeSuppliers`). */
  suppliersInsights: endpoint({
    id: 'suppliers.insights',
    method: 'GET',
    path: `${API}/supplier-insights`,
    query: SupplierInsightsQuery,
    response: z.object({ ...readContext, ...SupplierInsights.shape }),
  }),
  usersList: endpoint({ id: 'users.list', method: 'GET', path: `${API}/users`, response: collection(User) }),
  tasksList: endpoint({
    id: 'tasks.list',
    method: 'GET',
    path: `${API}/tasks`,
    query: TaskQuery,
    response: collection(TaskListItem),
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
