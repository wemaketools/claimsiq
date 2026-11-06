// @ts-check
/**
 * Backend ESLint flat config.
 *
 * `bun run lint` lints api/, src/server/, src/contracts/, src/mock-api/ and scripts/. The folders that do not exist
 * yet are skipped. The SPA has its own config (src/ui/eslint.config.js). The Playwright workspace is type-checked
 * with `bun run --filter @claimsiq/e2e typecheck`.
 *
 * Guards encoded here, and why:
 * - `process.env` is read ONLY by src/server/lib/config/index.ts. Everything else receives typed config from
 *   getConfig()/loadConfig(). Member access, destructuring (`no-restricted-properties` covers both) and
 *   `import { env } from 'node:process'` are blocked.
 * - src/contracts is pure TypeScript + zod shared by the SPA, the mock API and the backend: no Node or browser APIs,
 *   no imports other than zod and sibling contract files. Contract tests (*.test.ts) may use Node APIs.
 * - The mock API is dev/test only and never reachable from src/server or api/.
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
  regex: '^(?!zod(?:/|$)|\\.{1,2}/)',
  message:
    'src/contracts is pure: import only zod and sibling contract files. No Node, browser or server modules.',
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
        ...[
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
        ].map((name) => ({
          name,
          message: 'src/contracts is pure: no Node or browser APIs.',
        })),
      ],
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
