-- Master data of a tenant: users, clients, brokers, products, suppliers and policies. Every reference carries the
-- tenant, so a row can only point at a parent of its own tenant. Dates and times that the contracts call a moment
-- are kept exactly as the contracts write them (the `moment` domain).

create table users (
  tenant_id    text not null references tenants (tenant_id) on delete cascade,
  user_id      text not null,
  display_name text not null check (btrim(display_name) <> ''),
  role         text not null check (btrim(role) <> ''),
  team         text not null check (btrim(team) <> ''),
  primary key (tenant_id, user_id)
);
select enable_tenant_isolation('users');

create table clients (
  tenant_id    text not null references tenants (tenant_id) on delete cascade,
  client_id    text not null,
  name         text not null check (btrim(name) <> ''),
  segment      text not null check (btrim(segment) <> ''),
  region       text not null check (btrim(region) <> ''),
  is_corporate boolean not null,
  primary key (tenant_id, client_id)
);
select enable_tenant_isolation('clients');

create table brokers (
  tenant_id     text not null references tenants (tenant_id) on delete cascade,
  broker_id     text not null,
  name          text not null check (btrim(name) <> ''),
  channel       text not null check (channel in ('BROKER', 'DIRECT')),
  owner_user_id text not null,
  branch        text not null check (btrim(branch) <> ''),
  primary key (tenant_id, broker_id),
  foreign key (tenant_id, owner_user_id) references users (tenant_id, user_id)
);
select enable_tenant_isolation('brokers');

create table products (
  tenant_id         text not null references tenants (tenant_id) on delete cascade,
  product_id        text not null,
  class_of_business text not null check (btrim(class_of_business) <> ''),
  product_name      text not null check (btrim(product_name) <> ''),
  currency          text not null check (currency = 'BWP'),
  primary key (tenant_id, product_id)
);
select enable_tenant_isolation('products');

create table suppliers (
  tenant_id    text not null references tenants (tenant_id) on delete cascade,
  supplier_id  text not null,
  name         text not null check (btrim(name) <> ''),
  service_type text not null check (btrim(service_type) <> ''),
  active       boolean not null,
  primary key (tenant_id, supplier_id)
);
select enable_tenant_isolation('suppliers');

create table policies (
  tenant_id     text not null references tenants (tenant_id) on delete cascade,
  policy_id     text not null,
  policy_number text not null check (btrim(policy_number) <> ''),
  client_id     text not null,
  broker_id     text,
  product_id    text not null,
  inception_at  moment not null,
  expiry_at     moment not null,
  status        text not null check (btrim(status) <> ''),
  primary key (tenant_id, policy_id),
  foreign key (tenant_id, client_id) references clients (tenant_id, client_id),
  foreign key (tenant_id, broker_id) references brokers (tenant_id, broker_id),
  foreign key (tenant_id, product_id) references products (tenant_id, product_id)
);
create index policies_client_idx on policies (tenant_id, client_id);
select enable_tenant_isolation('policies');
