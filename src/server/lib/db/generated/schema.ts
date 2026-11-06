// GENERATED FILE, DO NOT EDIT: `bun run db:types` (scripts/db/generate-types.ts) rewrites it from the database.
import type { ColumnType, Generated } from 'kysely';

export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

export interface BrokersTable {
  tenant_id: string;
  broker_id: string;
  name: string;
  channel: string;
  owner_user_id: string;
  branch: string;
  row_no: ColumnType<number, never, never>;
}

export interface ClaimEventsTable {
  tenant_id: string;
  event_id: string;
  claim_id: string;
  event_at: string | null;
  from_stage: string | null;
  to_stage: string;
  reason: string;
  actor_id: string;
  row_no: ColumnType<number, never, never>;
}

export interface ClaimPaymentsTable {
  tenant_id: string;
  claim_payment_id: string;
  claim_id: string;
  paid_at: string;
  paid_amount: string;
  currency: string;
  payment_ref: string;
  status: string;
  row_no: ColumnType<number, never, never>;
}

export interface ClaimsTable {
  tenant_id: string;
  claim_id: string;
  policy_id: string;
  loss_at: string | null;
  reported_at: string | null;
  stage: string;
  status: string;
  handler_id: string;
  supplier_id: string | null;
  current_outstanding_reserve: string;
  currency: string;
  closed_at: string | null;
  row_no: ColumnType<number, never, never>;
}

export interface ClientsTable {
  tenant_id: string;
  client_id: string;
  name: string;
  segment: string;
  region: string;
  is_corporate: boolean;
  row_no: ColumnType<number, never, never>;
}

export interface DataIssuesTable {
  tenant_id: string;
  issue_no: number;
  kind: string;
  entity: string;
  file: string;
  source_row: number;
  record_id: string | null;
  field: string;
  problem: string;
  fix: string;
}

export interface InvoicesTable {
  tenant_id: string;
  invoice_id: string;
  policy_id: string;
  issue_date: string;
  due_date: string | null;
  issued_amount: string;
  currency: string;
  status: string;
  row_no: ColumnType<number, never, never>;
}

export interface PaymentAllocationsTable {
  tenant_id: string;
  allocation_id: string;
  receipt_id: string;
  invoice_id: string;
  allocated_amount: string;
  posted_at: string;
  row_no: ColumnType<number, never, never>;
}

export interface PaymentAttemptsTable {
  tenant_id: string;
  attempt_id: string;
  invoice_id: string;
  attempt_at: string;
  method: string;
  outcome: string;
  reason_code: string | null;
  row_no: ColumnType<number, never, never>;
}

export interface PoliciesTable {
  tenant_id: string;
  policy_id: string;
  policy_number: string;
  client_id: string;
  broker_id: string | null;
  product_id: string;
  inception_at: string;
  expiry_at: string;
  status: string;
  row_no: ColumnType<number, never, never>;
}

export interface ProductsTable {
  tenant_id: string;
  product_id: string;
  class_of_business: string;
  product_name: string;
  currency: string;
  row_no: ColumnType<number, never, never>;
}

export interface ReceiptsTable {
  tenant_id: string;
  receipt_id: string;
  received_at: string;
  gross_amount: string;
  currency: string;
  bank_ref: string;
  status: string;
  row_no: ColumnType<number, never, never>;
}

export interface ReserveEventsTable {
  tenant_id: string;
  reserve_event_id: string;
  claim_id: string;
  event_at: string;
  old_amount: string;
  new_amount: string;
  reason: string;
  row_no: ColumnType<number, never, never>;
}

export interface RuleConfigsTable {
  tenant_id: string;
  data_set: string;
  config: JsonValue;
  version: Generated<number>;
  updated_at: ColumnType<Date, Date | string | undefined, Date | string>;
  updated_by: string | null;
}

export interface SupplierRequestsTable {
  tenant_id: string;
  request_id: string;
  claim_id: string;
  supplier_id: string;
  requested_at: string | null;
  completed_at: string | null;
  request_type: string;
  row_no: ColumnType<number, never, never>;
}

export interface SuppliersTable {
  tenant_id: string;
  supplier_id: string;
  name: string;
  service_type: string;
  active: boolean;
  row_no: ColumnType<number, never, never>;
}

export interface TaskAuditEntriesTable {
  tenant_id: string;
  audit_id: ColumnType<number, never, never>;
  task_id: string;
  at: ColumnType<Date, Date | string, Date | string>;
  actor: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  actor_user_id: string | null;
}

export interface TaskCountersTable {
  tenant_id: string;
  next_number: Generated<number>;
}

export interface TasksTable {
  tenant_id: string;
  task_id: string;
  module: string;
  subject_type: string;
  subject_id: string;
  assigned_to: string | null;
  due_at: string | null;
  priority: string;
  status: string;
  note: string | null;
  updated_at: ColumnType<Date, Date | string, Date | string>;
  idempotency_key: string | null;
}

export interface TenantMembershipsTable {
  tenant_id: string;
  auth_user_id: string;
  persona: string;
}

export interface TenantsTable {
  tenant_id: string;
  display_name: string;
  dataset_tag: string;
  row_no: ColumnType<number, never, never>;
}

export interface UsersTable {
  tenant_id: string;
  user_id: string;
  display_name: string;
  role: string;
  team: string;
  row_no: ColumnType<number, never, never>;
}

export interface Database {
  brokers: BrokersTable;
  claim_events: ClaimEventsTable;
  claim_payments: ClaimPaymentsTable;
  claims: ClaimsTable;
  clients: ClientsTable;
  data_issues: DataIssuesTable;
  invoices: InvoicesTable;
  payment_allocations: PaymentAllocationsTable;
  payment_attempts: PaymentAttemptsTable;
  policies: PoliciesTable;
  products: ProductsTable;
  receipts: ReceiptsTable;
  reserve_events: ReserveEventsTable;
  rule_configs: RuleConfigsTable;
  supplier_requests: SupplierRequestsTable;
  suppliers: SuppliersTable;
  task_audit_entries: TaskAuditEntriesTable;
  task_counters: TaskCountersTable;
  tasks: TasksTable;
  tenant_memberships: TenantMembershipsTable;
  tenants: TenantsTable;
  users: UsersTable;
}

/** Every table with a tenant_id column: the tables the tenant helpers scope. */
export const TENANT_TABLES = [
  'brokers',
  'claim_events',
  'claim_payments',
  'claims',
  'clients',
  'data_issues',
  'invoices',
  'payment_allocations',
  'payment_attempts',
  'policies',
  'products',
  'receipts',
  'reserve_events',
  'rule_configs',
  'supplier_requests',
  'suppliers',
  'task_audit_entries',
  'task_counters',
  'tasks',
  'tenant_memberships',
  'tenants',
  'users',
] as const;
