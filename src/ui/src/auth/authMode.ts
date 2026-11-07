/**
 * The build-time authentication mode: `supabase` (real sign-in) or `prototype` (a role click, no password, no
 * supabase-js). `vite.config.ts` refuses a production build whose mode is neither chosen nor implied by the
 * Supabase variables, so `supabase` here is never a silent default of a deployed build.
 *
 * TRAP: the bundler folds `import.meta.env.VITE_AUTH_MODE === 'prototype'` to a literal and drops the dead branch, but
 * not a call to `authMode()`. Code that must disappear from a mode's bundle (the dynamic import of the Supabase
 * provider in AppProviders) compares the variable inline; `scan-bundle` fails a prototype build that still carries
 * supabase-js.
 */
export type AuthMode = 'supabase' | 'prototype';

export function authMode(): AuthMode {
  return import.meta.env.VITE_AUTH_MODE === 'prototype' ? 'prototype' : 'supabase';
}
