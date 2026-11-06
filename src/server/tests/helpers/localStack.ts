/** What the tests that talk to the local Supabase Auth stack share: whether it answers, and a real sign-in. */
import { getConfig, tryGetConfig } from '../../lib/config/index.js';

export const DEMO_PASSWORD = 'test1234';

/** An access token issued by Supabase Auth for a demo account. */
export async function passwordGrant(email: string, password = DEMO_PASSWORD): Promise<string> {
  const config = getConfig();
  const response = await fetch(`${config.supabase.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.supabase.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Sign-in failed (${response.status}); run bun run supabase:start and bun run auth:personas.`);
  }
  return ((await response.json()) as { access_token: string }).access_token;
}

/** True when `.env.local` is there and Auth answers its health check: the tests that need the stack skip without it. */
export async function stackIsReachable(): Promise<boolean> {
  const loaded = tryGetConfig();
  if (!loaded.ok) {
    return false;
  }
  try {
    const response = await fetch(`${loaded.config.supabase.url}/auth/v1/health`, {
      headers: { apikey: loaded.config.supabase.anonKey },
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
