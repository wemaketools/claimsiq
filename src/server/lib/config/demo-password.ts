/**
 * The password of the demo accounts. The local Supabase stack grants nothing beyond the machine it runs on, so its
 * password is committed on purpose; it must be at least `minimum_password_length` (6, supabase/config.toml).
 */
export const LOCAL_DEMO_PASSWORD = 'test1234';

export type DemoPasswordDecision =
  | { readonly ok: true; readonly password: string }
  | { readonly ok: false };

/**
 * The password to give or use for the demo accounts: the configured one, else the committed local one when `appEnv` is
 * `local`, else none. A hosted environment never falls back to a value that is in the repository.
 */
export function resolveDemoPassword(appEnv: string, configured: string | null): DemoPasswordDecision {
  if (configured !== null && configured !== '') {
    return { ok: true, password: configured };
  }
  return appEnv === 'local' ? { ok: true, password: LOCAL_DEMO_PASSWORD } : { ok: false };
}
