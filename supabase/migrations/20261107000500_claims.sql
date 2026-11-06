-- Claims and what happens to them: stage events, payments, reserve changes and supplier requests. A time the
-- source did not give is NULL and means UNKNOWN to the rules, never good or bad.

create table claims (
  tenant_id                   text not null references tenants (tenant_id) on delete cascade,
  claim_id                    text not null,
  policy_id                   text not null,
  loss_at                     moment,
  reported_at                 moment,
  stage                       text not null check (stage in ('New', 'Triage', 'Assessment', 'Negotiation', 'Approved', 'Settlement', 'Closed', 'Reopened')),
  status                      text not null check (status in ('OPEN', 'CLOSED')),
  handler_id                  text not null,
  supplier_id                 text,
  current_outstanding_reserve numeric(18, 2) not null check (current_outstanding_reserve >= 0),
  currency                    text not null check (currency = 'BWP'),
  closed_at                   moment,
  primary key (tenant_id, claim_id),
  foreign key (tenant_id, policy_id) references policies (tenant_id, policy_id),
  foreign key (tenant_id, handler_id) references users (tenant_id, user_id),
  foreign key (tenant_id, supplier_id) references suppliers (tenant_id, supplier_id)
);
create index claims_policy_idx on claims (tenant_id, policy_id);
create index claims_supplier_idx on claims (tenant_id, supplier_id);
select enable_tenant_isolation('claims');

create table claim_events (
  tenant_id  text not null references tenants (tenant_id) on delete cascade,
  event_id   text not null,
  claim_id   text not null,
  event_at   moment,
  from_stage text check (from_stage in ('New', 'Triage', 'Assessment', 'Negotiation', 'Approved', 'Settlement', 'Closed', 'Reopened')),
  to_stage   text not null check (to_stage in ('New', 'Triage', 'Assessment', 'Negotiation', 'Approved', 'Settlement', 'Closed', 'Reopened')),
  reason     text not null check (btrim(reason) <> ''),
  actor_id   text not null,
  primary key (tenant_id, event_id),
  foreign key (tenant_id, claim_id) references claims (tenant_id, claim_id),
  foreign key (tenant_id, actor_id) references users (tenant_id, user_id)
);
create index claim_events_claim_idx on claim_events (tenant_id, claim_id);
select enable_tenant_isolation('claim_events');

create table claim_payments (
  tenant_id        text not null references tenants (tenant_id) on delete cascade,
  claim_payment_id text not null,
  claim_id         text not null,
  paid_at          moment not null,
  paid_amount      numeric(18, 2) not null check (paid_amount >= 0),
  currency         text not null check (currency = 'BWP'),
  payment_ref      text not null check (btrim(payment_ref) <> ''),
  status           text not null check (status in ('POSTED', 'PENDING', 'VOID', 'REJECTED')),
  primary key (tenant_id, claim_payment_id),
  foreign key (tenant_id, claim_id) references claims (tenant_id, claim_id)
);
create index claim_payments_claim_idx on claim_payments (tenant_id, claim_id);
select enable_tenant_isolation('claim_payments');

create table reserve_events (
  tenant_id        text not null references tenants (tenant_id) on delete cascade,
  reserve_event_id text not null,
  claim_id         text not null,
  event_at         moment not null,
  old_amount       numeric(18, 2) not null check (old_amount >= 0),
  new_amount       numeric(18, 2) not null check (new_amount >= 0),
  reason           text not null check (btrim(reason) <> ''),
  primary key (tenant_id, reserve_event_id),
  foreign key (tenant_id, claim_id) references claims (tenant_id, claim_id)
);
create index reserve_events_claim_idx on reserve_events (tenant_id, claim_id);
select enable_tenant_isolation('reserve_events');

create table supplier_requests (
  tenant_id    text not null references tenants (tenant_id) on delete cascade,
  request_id   text not null,
  claim_id     text not null,
  supplier_id  text not null,
  requested_at moment,
  completed_at moment,
  request_type text not null check (btrim(request_type) <> ''),
  primary key (tenant_id, request_id),
  foreign key (tenant_id, claim_id) references claims (tenant_id, claim_id),
  foreign key (tenant_id, supplier_id) references suppliers (tenant_id, supplier_id)
);
create index supplier_requests_claim_idx on supplier_requests (tenant_id, claim_id);
create index supplier_requests_supplier_idx on supplier_requests (tenant_id, supplier_id);
select enable_tenant_isolation('supplier_requests');
