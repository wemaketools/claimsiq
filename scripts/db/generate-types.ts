/**
 * `bun run db:types`: writes the Kysely table types of the `public` schema to src/server/lib/db/generated/schema.ts,
 * read from the live database (the local stack, after `db:migrate`). The migration test regenerates the file from a
 * fresh scratch database and fails when the committed copy differs, so a migration without `db:types` cannot merge.
 *
 * Type choices that follow how node-postgres returns values: `numeric` and `bigint` are strings (never a float for
 * money), `timestamptz` is a Date. A column type this script does not know stops it; add the mapping here.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import pg from 'pg';

import { getConfig } from '../../src/server/lib/config/index.js';

export const SCHEMA_FILE = fileURLToPath(new URL('../../src/server/lib/db/generated/schema.ts', import.meta.url));

interface ColumnRow {
  table_name: string;
  column_name: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  is_identity: 'YES' | 'NO';
  identity_generation: 'ALWAYS' | 'BY DEFAULT' | null;
}

const COLUMNS_SQL = `
  select c.table_name, c.column_name, c.udt_name, c.is_nullable, c.column_default, c.is_identity, c.identity_generation
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
   order by c.table_name, c.ordinal_position`;

/** Select type and insert/update type of each Postgres type. */
const TYPES: Record<string, { select: string; write: string }> = {
  text: { select: 'string', write: 'string' },
  varchar: { select: 'string', write: 'string' },
  uuid: { select: 'string', write: 'string' },
  int2: { select: 'number', write: 'number' },
  int4: { select: 'number', write: 'number' },
  int8: { select: 'string', write: 'string' },
  numeric: { select: 'string', write: 'string' },
  bool: { select: 'boolean', write: 'boolean' },
  timestamptz: { select: 'Date', write: 'Date | string' },
  jsonb: { select: 'JsonValue', write: 'JsonValue' },
};

const pascal = (name: string): string => name.replace(/(^|_)([a-z0-9])/g, (_match, _sep, letter: string) => letter.toUpperCase());

function columnType(row: ColumnRow): string {
  const mapped = TYPES[row.udt_name];
  if (mapped === undefined) {
    throw new Error(`No TypeScript type for ${row.table_name}.${row.column_name} (${row.udt_name}); add it to TYPES in scripts/db/generate-types.ts.`);
  }
  const nullable = row.is_nullable === 'YES' ? ' | null' : '';
  const select = `${mapped.select}${nullable}`;
  if (row.identity_generation === 'ALWAYS') {
    return `ColumnType<${select}, never, never>`;
  }
  const write = `${mapped.write}${nullable}`;
  if (row.column_default !== null || row.is_identity === 'YES') {
    return write === select ? `Generated<${select}>` : `ColumnType<${select}, ${write} | undefined, ${write}>`;
  }
  return write === select ? select : `ColumnType<${select}, ${write}, ${write}>`;
}

export async function renderSchema(client: pg.ClientBase): Promise<string> {
  const { rows } = await client.query<ColumnRow>(COLUMNS_SQL);
  const tables = new Map<string, ColumnRow[]>();
  for (const row of rows) {
    tables.set(row.table_name, [...(tables.get(row.table_name) ?? []), row]);
  }
  const lines = [
    '// GENERATED FILE, DO NOT EDIT: `bun run db:types` (scripts/db/generate-types.ts) rewrites it from the database.',
    "import type { ColumnType, Generated } from 'kysely';",
    '',
    'export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];',
    '',
  ];
  for (const [table, columns] of tables) {
    lines.push(`export interface ${pascal(table)}Table {`);
    for (const column of columns) {
      lines.push(`  ${column.column_name}: ${columnType(column)};`);
    }
    lines.push('}', '');
  }
  lines.push('export interface Database {');
  for (const table of tables.keys()) {
    lines.push(`  ${table}: ${pascal(table)}Table;`);
  }
  lines.push('}', '');
  const tenantTables = [...tables].filter(([, columns]) => columns.some((column) => column.column_name === 'tenant_id')).map(([table]) => table);
  lines.push('/** Every table with a tenant_id column: the tables the tenant helpers scope. */');
  lines.push('export const TENANT_TABLES = [', ...tenantTables.map((table) => `  '${table}',`), '] as const;', '');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const url = getConfig().database.url;
  if (url === null) {
    throw new Error('DATABASE_URL is not set (see .env.local.example).');
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    writeFileSync(SCHEMA_FILE, await renderSchema(client), 'utf8');
  } finally {
    await client.end();
  }
  process.stdout.write(`Wrote ${SCHEMA_FILE}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    process.stderr.write(`db:types failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
