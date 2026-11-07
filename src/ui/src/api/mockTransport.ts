/**
 * Stage A transport: the mock API runs in the browser over the bundled CSV fixtures and keeps the changes made on top
 * of them in localStorage. A real server replaces this one module (the transport becomes the platform `fetch`).
 */
import { createMockApi } from '../../../mock-api/index';
import type { KeyValueStore } from '../../../mock-api/index';
import ruleConfig from '../../../../fixtures/v1/proposed_rule_config.json';
import type { ApiTransport } from './client';

const files = import.meta.glob('../../../../fixtures/v1/*/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function folderFiles(folder: 'test' | 'demo'): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files)
      .filter(([path]) => path.includes(`/v1/${folder}/`))
      .map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1), text]),
  );
}

/** localStorage looked up on every call, because merely touching it can throw when site data is blocked. */
const browserStorage: KeyValueStore = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};

export function createMockTransport(storage: KeyValueStore = browserStorage): ApiTransport {
  const api = createMockApi({
    fixtures: { TEST: folderFiles('test'), DEMO: folderFiles('demo') },
    storage,
    ruleConfig,
  });
  return api.fetch;
}
