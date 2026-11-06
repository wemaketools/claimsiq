-- Premium invoices, receipts, allocations and payment attempts: the stand-in for Premium Collections that Claim
-- Detail links to. Amounts are numeric(18,2) BWP, never a float; node-postgres returns them as strings.

create table invoices (
  tenant_id     text not null references tenants (tenant_id) on delete cascade,
  invoice_id    text not null,
  policy_id     text not null,
  issue_date    moment not null,
  due_date      moment,
  issued_amount numeric(18, 2) not null check (issued_amount >= 0),
  currency      text not null check (currency = 'BWP'),
  status        text not null check (btrim(status) <> ''),
  primary key (tenant_id, invoice_id),
  foreign key (tenant_id, policy_id) references policies (tenant_id, policy_id)
);
create index invoices_policy_idx on invoices (tenant_id, policy_id);
select enable_tenant_isolation('invoices');

create table receipts (
  tenant_id    text not null references tenants (tenant_id) on delete cascade,
  receipt_id   text not null,
  received_at  moment not null,
  gross_amount numeric(18, 2) not null check (gross_amount >= 0),
  currency     text not null check (currency = 'BWP'),
  bank_ref     text not null check (btrim(bank_ref) <> ''),
  status       text not null check (btrim(status) <> ''),
  primary key (tenant_id, receipt_id)
);
select enable_tenant_isolation('receipts');

create table payment_allocations (
  tenant_id        text not null references tenants (tenant_id) on delete cascade,
  allocation_id    text not null,
  receipt_id       text not null,
  invoice_id       text not null,
  allocated_amount numeric(18, 2) not null check (allocated_amount >= 0),
  posted_at        moment not null,
  primary key (tenant_id, allocation_id),
  foreign key (tenant_id, receipt_id) references receipts (tenant_id, receipt_id),
  foreign key (tenant_id, invoice_id) references invoices (tenant_id, invoice_id)
);
create index payment_allocations_invoice_idx on payment_allocations (tenant_id, invoice_id);
create index payment_allocations_receipt_idx on payment_allocations (tenant_id, receipt_id);
select enable_tenant_isolation('payment_allocations');

create table payment_attempts (
  tenant_id   text not null references tenants (tenant_id) on delete cascade,
  attempt_id  text not null,
  invoice_id  text not null,
  attempt_at  moment not null,
  method      text not null check (btrim(method) <> ''),
  outcome     text not null check (btrim(outcome) <> ''),
  reason_code text,
  primary key (tenant_id, attempt_id),
  foreign key (tenant_id, invoice_id) references invoices (tenant_id, invoice_id)
);
create index payment_attempts_invoice_idx on payment_attempts (tenant_id, invoice_id);
select enable_tenant_isolation('payment_attempts');
