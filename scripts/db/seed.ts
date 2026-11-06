/**
 * `bun run db:seed`: loads the TEST and DEMO fixtures into the LOCAL database, each as its own tenant, through the
 * fixture loader (`src/read-model/fixtures`, the mock API's too), so a row is accepted or quarantined by exactly the rules the
 * mock API applies. A quarantined row is reported and never inserted. Every run replaces the data set's rows, tasks
 * and audit trail included (the same as Reset in the demo), so a second run changes nothing.
 *
 * Also gives each demo persona account of local Supabase Auth a membership in both tenants (run `bun run auth:personas`
 * first; without the accounts the seed says so and links nobody) and loads `proposed_rule_config.json` as the rule
 * configuration of each tenant.
 *
 * Usage: bun run db:seed [-- --data-set TEST|DEMO]
 */
import { pathToFileURL } from 'node:url';

import { sql } from 'kysely';
import type { Kysely } from 'kysely';

import { DATA_SET_IDS, DataSetId, ENTITY_NAMES, PersonaId } from '../../src/contracts/index.js';
import type { DataIssue, EntityName } from '../../src/contracts/index.js';
import { loadDataset } from '../../src/read-model/index.js';
import type { FixtureFiles } from '../../src/read-model/index.js';
import { getConfig } from '../../src/server/lib/config/index.js';
import { ENTITY_TABLES, createDb } from '../../src/server/lib/db/index.js';
import type { Database } from '../../src/server/lib/db/index.js';
import { committedFixture } from '../../src/server/lib/seed/fixtureFiles.js';
import { replaceDataSetRows } from '../../src/server/lib/seed/replace.js';
import { DEMO_ACCOUNTS } from '../../src/ui/src/auth/demoAccountList.js';
import { requireLocalDatabaseUrl } from './local.js';

type Db = Kysely<Database>;

export interface PersonaAccount {
  readonly authUserId: string;
  readonly persona: PersonaId;
}

export interface SeedReport {
  readonly dataSet: DataSetId;
  readonly rows: Readonly<Record<EntityName, number>>;
  readonly quarantined: readonly DataIssue[];
  readonly warnings: readonly DataIssue[];
  readonly memberships: number;
}

/** The demo accounts in Supabase Auth, with the persona each one starts in (`head.of.claims@` is `head-of-claims`). */
export async function findPersonaAccounts(db: Db): Promise<PersonaAccount[]> {
  const emails = DEMO_ACCOUNTS.map((account) => account.email);
  const { rows } = await sql<{ id: string; email: string }>`select id, email from auth.users where email in (${sql.join(emails)})`.execute(db);
  return rows.map((row) => ({
    authUserId: row.id,
    persona: PersonaId.parse((row.email.split('@')[0] ?? '').replaceAll('.', '-')),
  }));
}

/** Replaces one data set, in one transaction: either all of it is there or none of it changed. */
export async function seedDataSet(
  db: Db,
  dataSet: DataSetId,
  files: FixtureFiles,
  ruleConfig: unknown,
  accounts: readonly PersonaAccount[],
): Promise<SeedReport> {
  const data = loadDataset(dataSet, files);

  await db.transaction().execute(async (trx) => {
    await replaceDataSetRows(trx, data, ruleConfig, accounts);
  });

  return {
    dataSet,
    rows: Object.fromEntries(ENTITY_NAMES.map((name) => [name, data.records[name].length])) as Record<EntityName, number>,
    quarantined: data.issues.filter((issue) => issue.kind === 'quarantined'),
    warnings: data.issues.filter((issue) => issue.kind === 'warning'),
    memberships: accounts.length,
  };
}

/** Seeds one data set from the committed fixtures in `fixtures/v1`. */
export async function seedFromFixtures(db: Db, dataSet: DataSetId, accounts: readonly PersonaAccount[]): Promise<SeedReport> {
  const { files, ruleConfig } = committedFixture(dataSet);
  return await seedDataSet(db, dataSet, files, ruleConfig, accounts);
}

function describeIssue(issue: DataIssue): string {
  return `${issue.file} line ${issue.row}${issue.record_id === null ? '' : ` (${issue.record_id})`}, ${issue.field}: ${issue.problem}. Fix: ${issue.fix}`;
}

export function formatReport(report: SeedReport): string {
  const counts = ENTITY_NAMES.map((name) => `${ENTITY_TABLES[name]} ${report.rows[name]}`).join(', ');
  const lines = [`${report.dataSet}: ${counts}`, `  memberships ${report.memberships}, warnings ${report.warnings.length}, quarantined rows ${report.quarantined.length}`];
  for (const issue of report.quarantined) {
    lines.push(`  QUARANTINED, not inserted: ${describeIssue(issue)}`);
  }
  if (report.memberships === 0) {
    lines.push('  No demo accounts found in Supabase Auth: run `bun run auth:personas` and seed again to link them.');
  }
  return lines.join('\n');
}

function requestedDataSets(argv: readonly string[]): readonly DataSetId[] {
  const flag = argv.indexOf('--data-set');
  return flag === -1 ? DATA_SET_IDS : [DataSetId.parse(argv[flag + 1])];
}

async function main(): Promise<void> {
  const db = createDb(requireLocalDatabaseUrl(getConfig()), 1);
  try {
    const accounts = await findPersonaAccounts(db);
    for (const dataSet of requestedDataSets(process.argv.slice(2))) {
      process.stdout.write(`${formatReport(await seedFromFixtures(db, dataSet, accounts))}\n`);
    }
  } finally {
    await db.destroy();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    process.stderr.write(`db:seed failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
