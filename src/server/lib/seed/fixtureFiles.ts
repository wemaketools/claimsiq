/** Reads the committed fixtures from disk: for the seed, the demo reset and tests. The SPA bundles the same files with Vite instead. */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { DataSetId } from '../../../contracts/index.js';
import type { FixtureFiles } from '../../../read-model/index.js';

const FIXTURE_ROOT = fileURLToPath(new URL('../../../../fixtures/v1/', import.meta.url));

export function readFixtureFiles(folder: 'test' | 'demo'): FixtureFiles {
  const dir = `${FIXTURE_ROOT}${folder}/`;
  return Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith('.csv'))
      .map((name) => [name, readFileSync(`${dir}${name}`, 'utf8')]),
  );
}

export function readFixtureJson(name: string): unknown {
  return JSON.parse(readFileSync(`${FIXTURE_ROOT}${name}`, 'utf8')) as unknown;
}

let specRuleConfig: unknown;

/** The spec's rule config (`proposed_rule_config.json`), read from disk once: the defaults of every tenant and data set. */
export function committedRuleConfig(): unknown {
  specRuleConfig ??= readFixtureJson('proposed_rule_config.json');
  return specRuleConfig;
}

/** The committed fixture files and rule configuration of a data set. */
export function committedFixture(dataSet: DataSetId): { readonly files: FixtureFiles; readonly ruleConfig: unknown } {
  return {
    files: readFixtureFiles(dataSet === 'TEST' ? 'test' : 'demo'),
    ruleConfig: committedRuleConfig(),
  };
}
