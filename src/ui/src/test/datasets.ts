/** The committed CSV fixtures and a mock API over files a test has changed (the SPA's own transport reads the originals). */
import ruleConfig from '../../../../fixtures/v1/proposed_rule_config.json';
import { createMockApi, memoryStore } from '../../../mock-api/index';
import type { FixtureFiles } from '../../../mock-api/index';
import type { ApiTransport } from '../api/client';

const csv = import.meta.glob('../../../../fixtures/v1/*/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export function fixtureFiles(name: 'test' | 'demo'): Record<string, string> {
  return Object.fromEntries(
    Object.entries(csv)
      .filter(([path]) => path.includes(`/v1/${name}/`))
      .map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1), text]),
  );
}

export function transportOver(files: { TEST?: FixtureFiles; DEMO?: FixtureFiles }): ApiTransport {
  return createMockApi({
    fixtures: {
      TEST: files.TEST ?? fixtureFiles('test'),
      DEMO: files.DEMO ?? fixtureFiles('demo'),
    },
    storage: memoryStore(),
    ruleConfig,
  }).fetch;
}
