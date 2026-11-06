/** The session middleware: a valid Supabase access token in `Authorization: Bearer`, or 401. */
import type { MiddlewareHandler } from 'hono';

import { HttpProblem } from '../errors/index.js';
import type { ApiEnv } from '../router/env.js';
import { extractBearerToken } from './verify.js';
import type { VerifyResult } from './verify.js';

export type TokenVerifier = (token: string | null | undefined) => Promise<VerifyResult>;

const BEARER = { 'WWW-Authenticate': 'Bearer' } as const;

export function requireSession(verify: TokenVerifier): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const result = await verify(extractBearerToken(c.req.header('Authorization')));
    if (!result.ok) {
      if (result.reason === 'jwks_unavailable') {
        throw new HttpProblem(503, 'Sign-in cannot be verified right now. Try again shortly.');
      }
      // The reason says why the token failed, so it goes to the log and never to the client.
      if (result.reason !== 'missing_token') {
        console.warn(`session refused: ${result.reason}`);
      }
      throw new HttpProblem(401, 'Sign in to continue.', [], BEARER);
    }
    c.set('session', result.token);
    await next();
  };
}
