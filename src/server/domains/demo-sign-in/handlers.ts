/**
 * Demo sign-in: signs a demo account in to Supabase Auth on the server, so the browser never holds the demo password.
 *
 * Called before there is a session, so the guard is the allow-list (`isDemoAccountEmail`): an endpoint that took any
 * e-mail would be a password oracle. Every refusal that is about the account (off the list, or Auth said no) is the
 * same problem; only a missing password (hosted environment without `DEMO_SEED_PASSWORD`) is told apart. Neither the
 * password nor the session is ever logged.
 */
import { DEMO_SIGN_IN_NOT_CONFIGURED_CODE, DEMO_SIGN_IN_REFUSED_CODE, isDemoAccountEmail } from '../../../contracts/index.js';
import type { DemoSession } from '../../../contracts/index.js';
import { resolveDemoPassword } from '../../lib/config/demo-password.js';
import type { AppConfig } from '../../lib/config/index.js';
import { HttpProblem } from '../../lib/errors/index.js';
import type { PublicHandlers } from '../../lib/router/contract.js';
import { createSignInClient } from '../../lib/supabase/index.js';

/** Password sign-in against Supabase Auth; null when Auth refuses the credentials. */
export type PasswordSignIn = (config: AppConfig, email: string, password: string) => Promise<DemoSession | null>;

export const signInWithSupabase: PasswordSignIn = async (config, email, password) => {
  const { data, error } = await createSignInClient(config).auth.signInWithPassword({ email, password });
  if (error !== null || data.session === null) {
    return null;
  }
  const { access_token, refresh_token, expires_at, expires_in } = data.session;
  return { access_token, refresh_token, expires_at: expires_at ?? Math.floor(Date.now() / 1000) + expires_in };
};

const REFUSED = 'Demo sign-in is not available for this account.';

export function demoSignInHandlers(signIn: PasswordSignIn = signInWithSupabase): PublicHandlers {
  return {
    authDemoSignIn: {
      run: async ({ config, correlationId, body }) => {
        const refuse = (reason: string): HttpProblem => {
          console.warn(`demo sign-in refused (${reason}) ${correlationId}`);
          return new HttpProblem(403, REFUSED, [], {}, DEMO_SIGN_IN_REFUSED_CODE);
        };
        if (!isDemoAccountEmail(body.email)) {
          throw refuse('not on the list');
        }
        const password = resolveDemoPassword(config.appEnv, config.seed.demoPassword);
        if (!password.ok) {
          console.warn(`demo sign-in is not configured: DEMO_SEED_PASSWORD is unset ${correlationId}`);
          throw new HttpProblem(503, 'Demo sign-in is not configured in this environment.', [], {}, DEMO_SIGN_IN_NOT_CONFIGURED_CODE);
        }
        const session = await signIn(config, body.email.trim().toLowerCase(), password.password);
        if (session === null) {
          throw refuse('Auth refused the sign-in');
        }
        return session;
      },
    },
  };
}
