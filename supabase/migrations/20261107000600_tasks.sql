-- Tasks and their audit trail (DD-20). The subject of a task is one of four kinds of record, so it has no foreign
-- key; the assignee does. An `Idempotency-Key` makes a repeated create return the same task.

create table tasks (
  tenant_id       text not null references tenants (tenant_id) on delete cascade,
  task_id         text not null,
  module          text not null check (module in ('CLAIMS', 'COLLECTIONS')),
  subject_type    text not null check (subject_type in ('CLAIM', 'POLICY', 'INVOICE', 'SUPPLIER')),
  subject_id      text not null check (btrim(subject_id) <> ''),
  assigned_to     text,
  due_at          moment,
  priority        text not null check (priority in ('LOW', 'MEDIUM', 'HIGH')),
  status          text not null check (status in ('OPEN', 'IN_PROGRESS', 'DONE')),
  note            text,
  updated_at      timestamptz not null,
  idempotency_key text,
  primary key (tenant_id, task_id),
  foreign key (tenant_id, assigned_to) references users (tenant_id, user_id),
  unique (tenant_id, idempotency_key)
);
create index tasks_subject_idx on tasks (tenant_id, subject_type, subject_id);
select enable_tenant_isolation('tasks');

-- Append only: the application role can add entries and read them, never change or remove one.
create table task_audit_entries (
  tenant_id  text not null references tenants (tenant_id) on delete cascade,
  audit_id   integer generated always as identity,
  task_id    text not null,
  at         timestamptz not null,
  actor      text not null check (actor in ('head-of-claims', 'claims-handler', 'supplier-coordinator', 'finance')),
  action     text not null check (action in ('CREATED', 'ASSIGNED', 'STATUS_CHANGED')),
  from_value text,
  to_value   text,
  note       text,
  primary key (tenant_id, audit_id),
  foreign key (tenant_id, task_id) references tasks (tenant_id, task_id) on delete cascade
);
create index task_audit_entries_task_idx on task_audit_entries (tenant_id, task_id, at);
select enable_tenant_isolation('task_audit_entries', 'select, insert');

-- Ids are TASK-0001 and up, counted per tenant.
create table task_counters (
  tenant_id   text primary key references tenants (tenant_id) on delete cascade,
  next_number integer not null default 1 check (next_number >= 1)
);
select enable_tenant_isolation('task_counters', 'select, insert, update');

create function next_task_id(p_tenant_id text) returns text
  language sql volatile
as $$
  insert into task_counters as c (tenant_id, next_number) values (p_tenant_id, 2)
  on conflict (tenant_id) do update set next_number = c.next_number + 1
  returning 'TASK-' || repeat('0', greatest(4 - length((c.next_number - 1)::text), 0)) || (c.next_number - 1)::text
$$;

revoke all on function next_task_id(text) from public, anon, authenticated;
grant execute on function next_task_id(text) to claimsiq_app;
