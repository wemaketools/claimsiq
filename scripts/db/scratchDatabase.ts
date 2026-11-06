/**
 * A throwaway database on the local Postgres for the database tests: the migrations applied to an empty database, so a
 * test can seed and wipe without touching the data of the stack. Supabase Auth's `auth.users` is the one outside
 * thing the schema points at, so a minimal stand-in table is created first.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { tryGetConfig } from '../../src/server/lib/config/index.js';
import { createDb } from '../../src/server/lib/db/index.js';
import type { Db } from '../../src/server/lib/db/index.js';

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));

/** The local database URL when it answers, else null: the database tests skip themselves without it. */
export async function reachableDatabaseUrl(): Promise<string | null> {
  const loaded = tryGetConfig();
  const url = loaded.ok ? loaded.config.database.url : null;
  if (url === null) {
    return null;
  }
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.query('select 1');
    return url;
  } catch {
    return null;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export interface ScratchDatabase {
  readonly url: string;
  readonly db: Db;
  /** Runs `work` on a plain connection to the scratch database, as the owner. */
  withClient<R>(work: (client: pg.Client) => Promise<R>): Promise<R>;
  drop(): Promise<void>;
}

export async function createScratchDatabase(serverUrl: string): Promise<ScratchDatabase> {
  const name = `claimsiq_scratch_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);

  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const scratchUrl = url.toString();
  const database: ScratchDatabase = {
    url: scratchUrl,
    db: createDb(scratchUrl, 2),
    async withClient(work) {
      const client = new pg.Client({ connectionString: scratchUrl });
      await client.connect();
      try {
        return await work(client);
      } finally {
        await client.end();
      }
    },
    async drop() {
      await database.db.destroy();
      await admin.query(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };

  try {
    await database.withClient(async (client) => {
      await client.query('create schema auth; create table auth.users (id uuid primary key default gen_random_uuid(), email text unique)');
      for (const file of readdirSync(MIGRATIONS).filter((entry) => entry.endsWith('.sql')).sort()) {
        await client.query(readFileSync(`${MIGRATIONS}${file}`, 'utf8'));
      }
    });
  } catch (error) {
    await database.drop();
    throw error;
  }
  return database;
}
