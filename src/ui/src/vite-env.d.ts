/// <reference types="vite/client" />

/**
 * The browser-safe variables: the build's authentication mode, and the Supabase URL and anon key of `supabase`
 * mode. A prototype build needs none of them set.
 */
interface ImportMetaEnv {
  readonly VITE_AUTH_MODE?: 'supabase' | 'prototype';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
