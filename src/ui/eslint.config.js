// @ts-check
/**
 * SPA ESLint flat config: typescript-eslint, react-hooks (the upstream flat `recommended` preset, including the
 * React Compiler correctness rules), react-refresh and Prettier compatibility. `bun run lint` also runs `prettier --check`, and warnings fail the lint (`--max-warnings 0`).
 *
 * Boundaries enforced here:
 * - The SPA never imports backend code (src/server). It talks to the API only through src/api/client.ts.
 * - The mock API (src/mock-api) is imported only by src/api/mockTransport.ts, the one place that picks the transport,
 *   and by tests; screens call the typed endpoints.
 * - `@supabase/supabase-js` is imported only by src/auth/**: the one browser client is for authentication
 *   only. Type-only imports are allowed anywhere.
 */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { sharedRules } from '../../eslint.shared.js';

const SERVER_BOUNDARY = {
  group: ['**/server', '**/server/**'],
  message: 'The SPA never imports backend code. Call the API through src/api/client.ts.',
};
const MOCK_API_BOUNDARY = {
  group: ['**/mock-api', '**/mock-api/**'],
  message:
    'Screens talk to the typed API through src/api/client.ts. Only src/api/mockTransport.ts imports the mock API.',
};
const SUPABASE_AUTH_ONLY = {
  name: '@supabase/supabase-js',
  allowTypeImports: true,
  message:
    'Only src/auth/** uses supabase-js (the one browser client, authentication only). Data goes through src/api/client.ts.',
};

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/', 'public/']),
  {
    name: 'claimsiq-ui/base',
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      ...sharedRules,
      'no-restricted-syntax': [
        'error',
        ...[
          "NewExpression[callee.name='ApiError'] > ObjectExpression > Property[key.name='title'] > :matches(Literal, TemplateLiteral)",
          "NewExpression[callee.name='ApiError'] > ObjectExpression > Property[key.name='title'] > :matches(ConditionalExpression, LogicalExpression) > :matches(Literal, TemplateLiteral)",
        ].map((selector) => ({
          selector,
          message: 'An ApiError title is shown to the user: take it from the catalog with t().',
        })),
      ],
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [SUPABASE_AUTH_ONLY], patterns: [SERVER_BOUNDARY, MOCK_API_BOUNDARY] },
      ],
    },
  },
  {
    name: 'claimsiq-ui/mock-api-importers',
    files: ['src/api/mockTransport.ts', '**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [SUPABASE_AUTH_ONLY], patterns: [SERVER_BOUNDARY] },
      ],
    },
  },
  {
    name: 'claimsiq-ui/auth-module',
    files: ['src/auth/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [SERVER_BOUNDARY, MOCK_API_BOUNDARY] },
      ],
    },
  },
  {
    name: 'claimsiq-ui/non-component-modules',
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}', 'src/main.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    name: 'claimsiq-ui/tooling',
    files: ['vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
]);
