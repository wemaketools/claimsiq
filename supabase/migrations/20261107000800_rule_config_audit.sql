-- The rule editor (DD-61): who changed which rule value, when, and from what to what. `rule_configs` already holds the
-- config, its `version` and who saved last; this is the append-only trail beside it. One row per changed value, and
-- the rows of one save share their `version`. The application role can add rows and read them, never change or remove
-- one; the demo reset (the owner) clears the trail with the config.

create table rule_config_audit_entries (
  tenant_id     text not null references tenants (tenant_id) on delete cascade,
  audit_id      integer generated always as identity,
  data_set      text not null,
  version       integer not null check (version >= 2),
  at            timestamptz not null,
  actor         persona not null,
  action        text not null check (action in ('CHANGED', 'RESTORED')),
  field         text not null check (btrim(field) <> ''),
  from_value    text,
  to_value      text,
  actor_user_id uuid,
  primary key (tenant_id, audit_id),
  foreign key (tenant_id, data_set) references rule_configs (tenant_id, data_set)
);
create index rule_config_audit_entries_version_idx on rule_config_audit_entries (tenant_id, version);
select enable_tenant_isolation('rule_config_audit_entries', 'append_only');
