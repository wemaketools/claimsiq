import { describe, expect, it } from 'vitest';

import { endpoints } from '../../contracts/index.js';
import { createMockApi } from '../api.js';
import { loadDataset } from '../fixtures/index.js';
import { memoryStore } from '../storage.js';
import { readFixtureFiles, readFixtureJson } from './fixtureFiles.js';
import { generateClaimsFixture } from './generatedFixture.js';

describe('the generated claims fixture', () => {
  it('is the same every time, loads without data issues, and the engine serves 500 claims that reconcile with their events well inside the 3 second budget', async () => {
    const base = readFixtureFiles('demo');
    const files = generateClaimsFixture(base, 500);
    expect(generateClaimsFixture(base, 500)).toEqual(files);
    expect(files['claims.csv']).not.toBe(generateClaimsFixture(base, 499)['claims.csv']);

    const data = loadDataset('DEMO', files);
    expect(data.issues).toEqual([]);
    expect(data.records.claim).toHaveLength(500);

    const api = createMockApi({
      fixtures: { TEST: readFixtureFiles('test'), DEMO: files },
      storage: memoryStore(),
      ruleConfig: readFixtureJson('proposed_rule_config.json'),
    });
    const started = performance.now();
    const response = await api.fetch(endpoints.claimsFacts.path, { headers: { 'X-Tenant-Id': 'DEMO' } });
    const answer = endpoints.claimsFacts.response.parse(await response.json());
    expect(performance.now() - started).toBeLessThan(1500);

    const { summary } = answer;
    expect(summary).toMatchObject({ claims: 500, stage_mismatches: 0, unknown_age: { count: 0 } });
    expect(summary.open + summary.closed).toBe(500);
    expect(summary.open).toBeGreaterThan(300);
    expect(summary.by_stage.filter((s) => s.stage !== 'Closed').reduce((n, s) => n + s.count, 0)).toBe(summary.open);
    expect(summary.by_age_bucket.reduce((n, b) => n + b.count, 0)).toBe(summary.open);
    expect(answer.items.every((fact) => fact.reserve_check === 'MATCHES')).toBe(true);
  });
});
