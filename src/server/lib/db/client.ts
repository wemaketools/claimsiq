/** The Kysely client over node-postgres: `numeric` and `bigint` stay strings, so an amount is never a float. */
import { Kysely, PostgresDialect } from 'kysely';
import type { Transaction } from 'kysely';
import pg from 'pg';

import { getConfig } from '../config/index.js';
import type { Database } from './generated/schema.js';

export type Db = Kysely<Database>;
export type DbTransaction = Transaction<Database>;
/** Anything that can run a query: the client, or the transaction of a request (a Kysely transaction is a client). */
export type DbExecutor = Db;

export function createDb(connectionString: string, max = 4): Db {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max }) }) });
}

let shared: Db | null = null;

/** The process-wide client for `DATABASE_URL`. */
export function getDb(): Db {
  if (shared === null) {
    const url = getConfig().database.url;
    if (url === null) {
      throw new Error('DATABASE_URL is not set (see .env.local.example).');
    }
    shared = createDb(url);
  }
  return shared;
}

export async function closeDb(): Promise<void> {
  const db = shared;
  shared = null;
  await db?.destroy();
}
