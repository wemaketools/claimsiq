/**
 * The 17 entities of the canonical data model, one zod schema each, keyed (tenant_id, id).
 * A field that may be missing in the source and then means "unknown" (a timestamp, never an amount) is nullable;
 * the rules treat null as UNKNOWN, never as good or bad.
 */
import { z } from 'zod';

import { DataSetId } from './datasets.js';
import { Currency, Id, Instant, Money, Moment, Text } from './primitives.js';

export const CLAIM_STAGES = [
  'New',
  'Triage',
  'Assessment',
  'Negotiation',
  'Approved',
  'Settlement',
  'Closed',
  'Reopened',
] as const;
export const ClaimStage = z.enum(CLAIM_STAGES);
export type ClaimStage = z.infer<typeof ClaimStage>;

export const ClaimStatus = z.enum(['OPEN', 'CLOSED']);
export const ClaimPaymentStatus = z.enum(['POSTED', 'PENDING', 'VOID', 'REJECTED']);

export const TASK_MODULES = ['CLAIMS', 'COLLECTIONS'] as const;
export const TASK_SUBJECT_TYPES = ['CLAIM', 'POLICY', 'INVOICE', 'SUPPLIER'] as const;
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE'] as const;
export const TaskModule = z.enum(TASK_MODULES);
export const TaskSubjectType = z.enum(TASK_SUBJECT_TYPES);
export const TaskPriority = z.enum(TASK_PRIORITIES);
export const TaskStatus = z.enum(TASK_STATUSES);
export type TaskPriority = z.infer<typeof TaskPriority>;
export type TaskStatus = z.infer<typeof TaskStatus>;

export const Tenant = z.object({
  tenant_id: Id,
  display_name: Text,
  dataset_tag: DataSetId,
});

export const User = z.object({
  tenant_id: Id,
  user_id: Id,
  display_name: Text,
  role: Text,
  team: Text,
});

export const Client = z.object({
  tenant_id: Id,
  client_id: Id,
  name: Text,
  segment: Text,
  region: Text,
  is_corporate: z.boolean(),
});

export const Broker = z.object({
  tenant_id: Id,
  broker_id: Id,
  name: Text,
  channel: z.enum(['BROKER', 'DIRECT']),
  owner_user_id: Id,
  branch: Text,
});

export const Product = z.object({
  tenant_id: Id,
  product_id: Id,
  class_of_business: Text,
  product_name: Text,
  currency: Currency,
});

export const Policy = z.object({
  tenant_id: Id,
  policy_id: Id,
  policy_number: Text,
  client_id: Id,
  broker_id: Id.nullable(),
  product_id: Id,
  inception_at: Moment,
  expiry_at: Moment,
  status: Text,
});

export const Invoice = z.object({
  tenant_id: Id,
  invoice_id: Id,
  policy_id: Id,
  issue_date: Moment,
  due_date: Moment.nullable(),
  issued_amount: Money,
  currency: Currency,
  status: Text,
});

export const Receipt = z.object({
  tenant_id: Id,
  receipt_id: Id,
  received_at: Moment,
  gross_amount: Money,
  currency: Currency,
  bank_ref: Text,
  status: Text,
});

export const PaymentAllocation = z.object({
  tenant_id: Id,
  allocation_id: Id,
  receipt_id: Id,
  invoice_id: Id,
  allocated_amount: Money,
  posted_at: Moment,
});

export const PaymentAttempt = z.object({
  tenant_id: Id,
  attempt_id: Id,
  invoice_id: Id,
  attempt_at: Moment,
  method: Text,
  outcome: Text,
  reason_code: Text.nullable(),
});

export const Claim = z.object({
  tenant_id: Id,
  claim_id: Id,
  policy_id: Id,
  loss_at: Moment.nullable(),
  reported_at: Moment.nullable(),
  stage: ClaimStage,
  status: ClaimStatus,
  handler_id: Id,
  supplier_id: Id.nullable(),
  current_outstanding_reserve: Money,
  currency: Currency,
  closed_at: Moment.nullable(),
});

export const ClaimEvent = z.object({
  tenant_id: Id,
  event_id: Id,
  claim_id: Id,
  event_at: Moment.nullable(),
  from_stage: ClaimStage.nullable(),
  to_stage: ClaimStage,
  reason: Text,
  actor_id: Id,
});

export const ClaimPayment = z.object({
  tenant_id: Id,
  claim_payment_id: Id,
  claim_id: Id,
  paid_at: Moment,
  paid_amount: Money,
  currency: Currency,
  payment_ref: Text,
  status: ClaimPaymentStatus,
});

export const ReserveEvent = z.object({
  tenant_id: Id,
  reserve_event_id: Id,
  claim_id: Id,
  event_at: Moment,
  old_amount: Money,
  new_amount: Money,
  reason: Text,
});

export const Supplier = z.object({
  tenant_id: Id,
  supplier_id: Id,
  name: Text,
  service_type: Text,
  active: z.boolean(),
});

export const SupplierRequest = z.object({
  tenant_id: Id,
  request_id: Id,
  claim_id: Id,
  supplier_id: Id,
  requested_at: Moment.nullable(),
  completed_at: Moment.nullable(),
  request_type: Text,
});

export const Task = z.object({
  tenant_id: Id,
  task_id: Id,
  module: TaskModule,
  subject_type: TaskSubjectType,
  subject_id: Id,
  assigned_to: Id.nullable(),
  due_at: Moment.nullable(),
  priority: TaskPriority,
  status: TaskStatus,
  note: z.string().nullable(),
  updated_at: Instant,
});

export interface EntityReference {
  readonly field: string;
  readonly entity: EntityName;
  /** An optional reference may be null (a policy without a broker is direct business). */
  readonly optional: boolean;
}

export interface EntityDefinition<S extends z.ZodObject = z.ZodObject> {
  readonly name: EntityName;
  readonly file: string;
  /** The key is (tenant_id, idField). */
  readonly idField: string;
  readonly schema: S;
  readonly booleanFields: readonly string[];
  readonly references: readonly EntityReference[];
}

/** Parents come before the entities that point at them: the loader checks references in this order. */
export const ENTITY_NAMES = [
  'tenant',
  'user',
  'client',
  'broker',
  'product',
  'supplier',
  'policy',
  'invoice',
  'receipt',
  'payment_allocation',
  'payment_attempt',
  'claim',
  'claim_event',
  'claim_payment',
  'reserve_event',
  'supplier_request',
  'task',
] as const;
export type EntityName = (typeof ENTITY_NAMES)[number];

function entity<S extends z.ZodObject>(
  name: EntityName,
  file: string,
  idField: string,
  schema: S,
  extra: { booleanFields?: readonly string[]; references?: readonly EntityReference[] } = {},
): EntityDefinition<S> {
  return { name, file, idField, schema, booleanFields: extra.booleanFields ?? [], references: extra.references ?? [] };
}

const ref = (field: string, target: EntityName, optional = false): EntityReference => ({ field, entity: target, optional });

export const ENTITIES = {
  tenant: entity('tenant', 'tenants.csv', 'tenant_id', Tenant),
  user: entity('user', 'users.csv', 'user_id', User),
  client: entity('client', 'clients.csv', 'client_id', Client, { booleanFields: ['is_corporate'] }),
  broker: entity('broker', 'brokers.csv', 'broker_id', Broker, { references: [ref('owner_user_id', 'user')] }),
  product: entity('product', 'products.csv', 'product_id', Product),
  supplier: entity('supplier', 'suppliers.csv', 'supplier_id', Supplier, { booleanFields: ['active'] }),
  policy: entity('policy', 'policies.csv', 'policy_id', Policy, {
    references: [ref('client_id', 'client'), ref('broker_id', 'broker', true), ref('product_id', 'product')],
  }),
  invoice: entity('invoice', 'premium_invoices.csv', 'invoice_id', Invoice, { references: [ref('policy_id', 'policy')] }),
  receipt: entity('receipt', 'receipts.csv', 'receipt_id', Receipt),
  payment_allocation: entity('payment_allocation', 'payment_allocations.csv', 'allocation_id', PaymentAllocation, {
    references: [ref('receipt_id', 'receipt'), ref('invoice_id', 'invoice')],
  }),
  payment_attempt: entity('payment_attempt', 'payment_attempts.csv', 'attempt_id', PaymentAttempt, {
    references: [ref('invoice_id', 'invoice')],
  }),
  claim: entity('claim', 'claims.csv', 'claim_id', Claim, {
    references: [ref('policy_id', 'policy'), ref('handler_id', 'user'), ref('supplier_id', 'supplier', true)],
  }),
  claim_event: entity('claim_event', 'claim_events.csv', 'event_id', ClaimEvent, {
    references: [ref('claim_id', 'claim'), ref('actor_id', 'user')],
  }),
  claim_payment: entity('claim_payment', 'claim_payments.csv', 'claim_payment_id', ClaimPayment, {
    references: [ref('claim_id', 'claim')],
  }),
  reserve_event: entity('reserve_event', 'reserve_events.csv', 'reserve_event_id', ReserveEvent, {
    references: [ref('claim_id', 'claim')],
  }),
  supplier_request: entity('supplier_request', 'supplier_requests.csv', 'request_id', SupplierRequest, {
    references: [ref('claim_id', 'claim'), ref('supplier_id', 'supplier')],
  }),
  task: entity('task', 'tasks.csv', 'task_id', Task, { references: [ref('assigned_to', 'user', true)] }),
} as const satisfies Record<EntityName, EntityDefinition>;

export type Tenant = z.infer<typeof Tenant>;
export type User = z.infer<typeof User>;
export type Client = z.infer<typeof Client>;
export type Broker = z.infer<typeof Broker>;
export type Product = z.infer<typeof Product>;
export type Policy = z.infer<typeof Policy>;
export type Invoice = z.infer<typeof Invoice>;
export type Receipt = z.infer<typeof Receipt>;
export type PaymentAllocation = z.infer<typeof PaymentAllocation>;
export type PaymentAttempt = z.infer<typeof PaymentAttempt>;
export type Claim = z.infer<typeof Claim>;
export type ClaimEvent = z.infer<typeof ClaimEvent>;
export type ClaimPayment = z.infer<typeof ClaimPayment>;
export type ReserveEvent = z.infer<typeof ReserveEvent>;
export type Supplier = z.infer<typeof Supplier>;
export type SupplierRequest = z.infer<typeof SupplierRequest>;
export type Task = z.infer<typeof Task>;
