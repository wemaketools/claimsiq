// @ts-check
/**
 * Backend ESLint flat config.
 *
 * `bun run lint` lints api/, src/server/, src/contracts/, src/mock-api/, src/read-model/, src/rules/ and scripts/. The folders that do not exist
 * yet are skipped. The SPA has its own config (src/ui/eslint.config.js). The Playwright workspace is type-checked
 * with `bun run --filter @claimsiq/e2e typecheck`.
 *
 * Guards encoded here, and why:
 * - `process.env` is read ONLY by src/server/lib/config/index.ts. Everything else receives typed config from
 *   getConfig()/loadConfig(). Member access, destructuring (`no-restricted-properties` covers both) and
 *   `import { env } from 'node:process'` are blocked.
 * - src/contracts is pure TypeScript + zod (+ decimal.js for money) shared by the SPA, the mock API and the backend:
 *   no Node or browser APIs, no imports other than those and sibling contract files. Contract tests (*.test.ts) may
 *   use Node APIs.
 * - src/rules (the claims rules engine) is pure too: only zod, decimal.js, its own files and src/contracts, and no
 *   Node or browser APIs, so Collections and the SPA can reuse it. Its tests may use Node APIs.
 * - src/read-model (the record sets and the reads both transports answer through) is pure as well: zod, decimal.js,
 *   its own files, src/contracts and src/rules, and nothing of the server, the mock API or the SPA (test-support
 *   included). Its tests and test-support may use Node APIs; its tests may read the server's fixture readers.
 * - The mock API runs in the browser in prototype builds (no Node modules outside its tests) and is never
 *   reachable from src/server or api/.
 */
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { sharedRules } from './eslint.shared.js';

const CONFIG_ONLY =
  'Only src/server/lib/config/index.ts may read process.env. Use getConfig()/loadConfig() from src/server/lib/config.';

/** Blocks every way of reaching process.env outside the config module. */
const processEnvImportPaths = [
  { name: 'node:process', importNames: ['env'], message: CONFIG_ONLY },
  { name: 'process', importNames: ['env'], message: CONFIG_ONLY },
];

const MOCK_API_BOUNDARY = {
  group: ['**/mock-api', '**/mock-api/**'],
  message:
    'The mock API is a dev/test tool. The real backend and api/ never import it.',
};
const SPA_BOUNDARY = {
  group: ['**/ui/src', '**/ui/src/**'],
  message: 'Backend code never imports the SPA.',
};
const CONTRACTS_PURITY = {
  regex: '^(?!zod(?:/|$)|decimal\\.js$|\\.{1,2}/)',
  message:
    'src/contracts is pure: import only zod, decimal.js and sibling contract files. No Node, browser or server modules.',
};
const RULES_PURITY = {
  regex: '^(?!zod(?:/|$)|decimal\\.js$|\\./|\\.\\./contracts/)',
  message:
    'src/rules is pure: import only zod, decimal.js, files of src/rules and src/contracts. No Node, browser, mock API or server modules.',
};
const READ_MODEL_PURITY = {
  regex: '^(?!zod(?:/|$)|decimal\\.js$|\\.{1,2}/)',
  message:
    'src/read-model is pure: import only zod, decimal.js, files of src/read-model, src/contracts and src/rules. No Node, browser, mock API or server modules.',
};
const READ_MODEL_BOUNDARIES = [
  MOCK_API_BOUNDARY,
  SPA_BOUNDARY,
  { group: ['**/server', '**/server/**'], message: 'src/read-model is shared with the browser: it never imports the server.' },
];
const PURE_GLOBALS = [
  'process',
  'Buffer',
  'require',
  '__dirname',
  '__filename',
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'fetch',
  'XMLHttpRequest',
];
const BROWSER_SAFE = {
  regex: '^(node:|fs$|path$|os$|child_process$)',
  message: 'src/mock-api runs in the browser: no Node modules outside its tests.',
};

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    'src/ui/',
    'e2e_tests/',
    'docs/',
    'supabase/',
    '.build/',
    '.qa-scratch/',
    '.test-results/',
  ]),
  {
    name: 'claimsiq/backend',
    files: ['**/*.{ts,mts,cts,js,mjs,cjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      ...sharedRules,
      'no-restricted-properties': ['error', { object: 'process', property: 'env', message: CONFIG_ONLY }],
      'no-restricted-imports': ['error', { paths: processEnvImportPaths }],
    },
  },
  {
    name: 'claimsiq/backend-boundaries',
    files: ['src/server/**/*.ts', 'api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: processEnvImportPaths, patterns: [MOCK_API_BOUNDARY, SPA_BOUNDARY] },
      ],
    },
  },
  {
    name: 'claimsiq/contracts-purity',
    files: ['src/contracts/**/*.ts'],
    ignores: ['src/contracts/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: processEnvImportPaths, patterns: [CONTRACTS_PURITY] }],
      'no-restricted-globals': [
        'error',
        ...PURE_GLOBALS.map((name) => ({ name, message: 'src/contracts is pure: no Node or browser APIs.' })),
      ],
    },
  },
  {
    name: 'claimsiq/rules-purity',
    files: ['src/rules/**/*.ts'],
    ignores: ['src/rules/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: processEnvImportPaths, patterns: [RULES_PURITY] }],
      'no-restricted-globals': [
        'error',
        ...PURE_GLOBALS.map((name) => ({ name, message: 'src/rules is pure: no Node or browser APIs.' })),
      ],
    },
  },
  {
    // The boundary reaches test-support too: only the tests themselves may read the server's fixture readers.
    name: 'claimsiq/read-model-boundary',
    files: ['src/read-model/**/*.ts'],
    ignores: ['src/read-model/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: processEnvImportPaths, patterns: READ_MODEL_BOUNDARIES }],
    },
  },
  {
    name: 'claimsiq/read-model-purity',
    files: ['src/read-model/**/*.ts'],
    ignores: ['src/read-model/**/*.test.ts', 'src/read-model/test-support/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: processEnvImportPaths, patterns: [READ_MODEL_PURITY, ...READ_MODEL_BOUNDARIES] }],
      'no-restricted-globals': [
        'error',
        ...PURE_GLOBALS.map((name) => ({ name, message: 'src/read-model is pure: no Node or browser APIs.' })),
      ],
    },
  },
  {
    name: 'claimsiq/mock-api-browser-safe',
    files: ['src/mock-api/**/*.ts'],
    ignores: ['src/mock-api/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: processEnvImportPaths, patterns: [BROWSER_SAFE] }],
    },
  },
  {
    name: 'claimsiq/config-module',
    files: ['src/server/lib/config/index.ts'],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-imports': ['error', { patterns: [MOCK_API_BOUNDARY, SPA_BOUNDARY] }],
    },
  },
]);
