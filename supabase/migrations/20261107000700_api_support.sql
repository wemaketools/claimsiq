-- What the API needs beyond the schema of the data itself:
--   * `row_no` on the master and transaction tables keeps the order the fixture gave the rows, so a read returns them in
--     that order (a select without an order is not guaranteed one). Only the owner inserts into these tables.
--   * `data_issues` holds what the loader rejected or flagged when the data set was seeded, for the Data issues list.
--   * a task's audit entry also records the signed-in account that made the change; the persona stays the visible actor.

do $$
declare
  t text;
begin
  foreach t in array array[
    'tenants', 'users', 'clients', 'brokers', 'products', 'suppliers', 'policies', 'invoices', 'receipts',
    'payment_allocations', 'payment_attempts', 'claims', 'claim_events', 'claim_payments', 'reserve_events',
    'supplier_requests'
  ] loop
    execute format('alter table %I add column row_no integer generated always as identity', t);
  end loop;
end
$$;

create table data_issues (
  tenant_id  text not null references tenants (tenant_id) on delete cascade,
  issue_no   integer not null check (issue_no >= 1),
  kind       text not null check (kind in ('quarantined', 'warning')),
  entity     text not null check (btrim(entity) <> ''),
  file       text not null check (btrim(file) <> ''),
  source_row integer not null check (source_row >= 1),
  record_id  text,
  field      text not null check (btrim(field) <> ''),
  problem    text not null check (btrim(problem) <> ''),
  fix        text not null check (btrim(fix) <> ''),
  primary key (tenant_id, issue_no)
);
select enable_tenant_isolation('data_issues', 'read_only');

alter table task_audit_entries add column actor_user_id uuid;
