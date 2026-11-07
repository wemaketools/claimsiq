-- Tenants, who may enter them, and the rule configuration each one runs on. TEST and DEMO are two tenants (data
-- sets) of one database and never mix: every other table is keyed (tenant_id, <entity>_id).

create table tenants (
  tenant_id    text primary key,
  display_name text not null check (btrim(display_name) <> ''),
  dataset_tag  text not null check (dataset_tag in ('TEST', 'DEMO')),
  unique (tenant_id, dataset_tag)
);
select enable_tenant_isolation('tenants', 'read_only');

-- A demo persona account (Supabase Auth) may enter a tenant only through a row here. The persona is the view the
-- account starts in, never authentication (DD-07). Written by the seed (owner), read by the API before it knows the
-- tenant, so claimsiq_app may only read its own tenant's rows.
create table tenant_memberships (
  tenant_id    text not null references tenants (tenant_id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  persona      persona not null,
  primary key (tenant_id, auth_user_id)
);
create index tenant_memberships_user_idx on tenant_memberships (auth_user_id);
select enable_tenant_isolation('tenant_memberships', 'read_only');

-- The claims rule configuration (the shape of src/rules/config.ts, seeded from fixtures/v1/proposed_rule_config.json),
-- one per tenant and data set so the rule editor can change a tenant's thresholds. `version` counts the saves.
create table rule_configs (
  tenant_id  text not null,
  data_set   text not null,
  config     jsonb not null check (jsonb_typeof(config) = 'object'),
  version    integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  updated_by persona,
  primary key (tenant_id, data_set),
  foreign key (tenant_id, data_set) references tenants (tenant_id, dataset_tag) on delete cascade
);
select enable_tenant_isolation('rule_configs', 'no_delete');
