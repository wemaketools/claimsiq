/**
 * Tenant isolation in the API layer, with row level security behind it.
 *
 * Every tenant request runs through `withTenant`: one transaction that switches to the `claimsiq_app` role and sets the
 * tenant the policies compare against (`app.tenant_id`), and hands out a `TenantScope` whose queries also carry the
 * tenant predicate themselves. Either layer alone is enough to keep another tenant's rows out; a forgotten predicate
 * is caught by RLS and a forgotten role switch by the predicate.
 *
 * Trap: `set_config(..., true)` and `SET LOCAL` last for the transaction only. Outside `withTenant` the connection is
 * the owner's, which bypasses RLS: use it only for the migrations, the seed and the membership lookup.
 */
import { sql } from 'kysely';
import type {
  DeleteQueryBuilder,
  DeleteResult,
  Expression,
  Insertable,
  InsertQueryBuilder,
  InsertResult,
  SelectQueryBuilder,
  SqlBool,
  UpdateQueryBuilder,
  UpdateResult,
} from 'kysely';

import type { Db, DbExecutor } from './client.js';
import type { Database, TENANT_TABLES } from './generated/schema.js';

declare const tenantIdBrand: unique symbol;

/** A tenant the caller may act in: only `toTenantId` makes one, and only the tenancy lookup should call it. */
export type TenantId = string & { readonly [tenantIdBrand]: 'TenantId' };

export type TenantTable = (typeof TENANT_TABLES)[number];

const TENANT_ID_FORMAT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function isTenantId(value: unknown): value is TenantId {
  return typeof value === 'string' && TENANT_ID_FORMAT.test(value);
}

export function toTenantId(value: string): TenantId {
  if (!isTenantId(value)) {
    throw new TypeError('Not a tenant id: letters, digits, "_" and "-", at most 64 characters.');
  }
  return value;
}

/** `<table>.tenant_id = <tenant>`, for the queries `TenantScope` does not build (joins, CTEs). */
export function tenantPredicate(table: TenantTable, tenantId: TenantId): Expression<SqlBool> {
  return sql<SqlBool>`${sql.ref(`${table}.tenant_id`)} = ${tenantId}`;
}

export interface TenantScope {
  readonly tenantId: TenantId;
  /** The transaction itself, for a query the scope does not build. Add `tenantPredicate` to such a query. */
  readonly db: DbExecutor;
  selectFrom<T extends TenantTable>(table: T): SelectQueryBuilder<Database, T, object>;
  updateTable<T extends TenantTable>(table: T): UpdateQueryBuilder<Database, T, T, UpdateResult>;
  deleteFrom<T extends TenantTable>(table: T): DeleteQueryBuilder<Database, T, DeleteResult>;
  /** Inserts rows into the tenant: the row types leave `tenant_id` out, so a row cannot name another tenant. */
  insertInto<T extends TenantTable>(
    table: T,
    rows: Omit<Insertable<Database[T]>, 'tenant_id'> | readonly Omit<Insertable<Database[T]>, 'tenant_id'>[],
  ): InsertQueryBuilder<Database, T, InsertResult>;
}

// Kysely cannot resolve its `where` overloads over a generic table name, so the builders are built for the whole
// union of tenant tables and typed back to the one table the caller named.
export function forTenant(db: DbExecutor, tenantId: TenantId): TenantScope {
  return {
    tenantId,
    db,
    selectFrom: <T extends TenantTable>(table: T) =>
      db.selectFrom(table as TenantTable).where(tenantPredicate(table, tenantId)) as unknown as SelectQueryBuilder<Database, T, object>,
    updateTable: <T extends TenantTable>(table: T) =>
      db.updateTable(table as TenantTable).where(tenantPredicate(table, tenantId)) as unknown as UpdateQueryBuilder<Database, T, T, UpdateResult>,
    deleteFrom: <T extends TenantTable>(table: T) =>
      db.deleteFrom(table as TenantTable).where(tenantPredicate(table, tenantId)) as unknown as DeleteQueryBuilder<Database, T, DeleteResult>,
    insertInto: (table, rows) => {
      const list = Array.isArray(rows) ? rows : [rows];
      return db.insertInto(table).values(list.map((row) => ({ ...row, tenant_id: tenantId })) as Insertable<Database[typeof table]>[]);
    },
  };
}

/** Runs `work` as one transaction in the tenant, under the `claimsiq_app` role and its RLS policies. */
export async function withTenant<R>(db: Db, tenantId: TenantId, work: (scope: TenantScope) => Promise<R>): Promise<R> {
  return await db.transaction().execute(async (trx) => {
    await sql`set local role claimsiq_app`.execute(trx);
    await sql`select set_config('app.tenant_id', ${tenantId}, true)`.execute(trx);
    return await work(forTenant(trx, tenantId));
  });
}
