-- The application role and the one way a table becomes tenant-isolated.
--
-- Two ways into this database, and only one of them is subject to row level security:
--   * the owner (postgres: migrations, the seed, the membership lookup before a tenant is known) bypasses RLS;
--   * the API runs every tenant request as `claimsiq_app` (SET LOCAL ROLE inside a transaction, see
--     src/server/lib/db/tenant.ts), with the verified tenant in the transaction-local setting `app.tenant_id`.
-- A request without that setting sees no rows and can write none: the policies compare against NULL.
--
-- Nothing here is reachable through Supabase's own REST API: `anon` and `authenticated` get no privileges on any
-- table this schema creates, and every table has RLS enabled with a policy for `claimsiq_app` only.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'claimsiq_app') then
    create role claimsiq_app nologin noinherit nobypassrls;
  end if;
end
$$;

grant claimsiq_app to postgres;
grant usage on schema public to claimsiq_app;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

create function app_tenant_id() returns text
  language sql stable
as $$ select nullif(current_setting('app.tenant_id', true), '') $$;

revoke all on function app_tenant_id() from public, anon, authenticated;
grant execute on function app_tenant_id() to claimsiq_app;

-- Every table with a tenant_id column calls this once, right after it is created. `p_mode` is what `claimsiq_app` may
-- do with the rows of its own tenant, by name, so no call spells out a privilege list:
--   full        select, insert, update, delete
--   no_delete   select, insert, update   (a table whose rows other rows depend on, or that must never shrink)
--   append_only select, insert           (an audit trail)
--   read_only   select
create function enable_tenant_isolation(p_table regclass, p_mode text default 'full')
  returns void
  language plpgsql
as $$
declare
  privileges text := case p_mode
    when 'full' then 'select, insert, update, delete'
    when 'no_delete' then 'select, insert, update'
    when 'append_only' then 'select, insert'
    when 'read_only' then 'select'
  end;
begin
  if privileges is null then
    raise exception 'unknown isolation mode %', p_mode;
  end if;
  execute format('alter table %s enable row level security', p_table);
  execute format(
    'create policy tenant_isolation on %s for all to claimsiq_app using (tenant_id = app_tenant_id()) with check (tenant_id = app_tenant_id())',
    p_table
  );
  execute format('grant %s on %s to claimsiq_app', privileges, p_table);
end
$$;

revoke all on function enable_tenant_isolation(regclass, text) from public, anon, authenticated;
