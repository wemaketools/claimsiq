/// <reference types="vite/client" />

/** The only browser-safe variables: the Supabase URL and anon key for authentication. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
