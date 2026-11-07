/** The table of each contract entity. */
import type { EntityName } from '../../../contracts/index.js';
import type { Database } from './generated/schema.js';

export const ENTITY_TABLES = {
  tenant: 'tenants',
  user: 'users',
  client: 'clients',
  broker: 'brokers',
  product: 'products',
  supplier: 'suppliers',
  policy: 'policies',
  invoice: 'invoices',
  receipt: 'receipts',
  payment_allocation: 'payment_allocations',
  payment_attempt: 'payment_attempts',
  claim: 'claims',
  claim_event: 'claim_events',
  claim_payment: 'claim_payments',
  reserve_event: 'reserve_events',
  supplier_request: 'supplier_requests',
  task: 'tasks',
} as const satisfies Record<EntityName, keyof Database>;
