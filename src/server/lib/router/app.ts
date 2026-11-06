/**
 * The /api/v1 Hono application. One app, one Vercel function (`api/v1/index.ts`); `scripts/dev/serve-api.ts` hosts the
 * same app locally.
 *
 * Middleware order, outermost first:
 *   1. security headers: so even a 401, a 404 and a 500 carry them
 *   2. correlation id: the id of the request, echoed in the response and in every problem document
 *   3. session: the Supabase access token (401), everything but `/health`
 *   4. tenant: `X-Tenant-Id` against the user's memberships on every request (400 without, 403 for a non-member)
 *   5. the routes: `/health` and one route per contract endpoint
 * Anything thrown becomes problem+json in `onError`; an unexpected error answers 500 with the correlation id and the
 * cause only in the server log.
 */
import { Hono } from 'hono';

import { demoHandlers } from '../../domains/demo/handlers.js';
import { readHandlers } from '../../domains/reads/handlers.js';
import { taskHandlers } from '../../domains/tasks/handlers.js';
import { requireSession } from '../auth/middleware.js';
import type { TokenVerifier } from '../auth/middleware.js';
import { verifyAccessToken } from '../auth/verify.js';
import { getConfig } from '../config/index.js';
import type { AppConfig } from '../config/index.js';
import { getDb } from '../db/index.js';
import type { Db } from '../db/index.js';
import { CORRELATION_ID_HEADER, HttpProblem, problemResponse, resolveCorrelationId } from '../errors/index.js';
import { requireTenantAccess } from '../tenancy/middleware.js';
import { mountEndpoints } from './contract.js';
import type { Handlers } from './contract.js';
import type { ApiEnv } from './env.js';

export type { ApiEnv } from './env.js';

export const API_BASE_PATH = '/api/v1';
export const HEALTH_PATH = `${API_BASE_PATH}/health`;

export interface AppDeps {
  readonly config: AppConfig;
  /** The owner's connection: the membership lookup and the demo reset; tenant requests switch role inside `withTenant`. */
  readonly db: Db;
  readonly verify: TokenVerifier;
  readonly now?: () => Date;
}

export type ApiApp = Hono<ApiEnv>;

const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'no-referrer'],
  ['X-Frame-Options', 'DENY'],
  ['Content-Security-Policy', "frame-ancestors 'none'"],
  ['Cache-Control', 'no-store'],
];

const handlers: Handlers = { ...readHandlers, ...taskHandlers, ...demoHandlers };

export function buildApp(deps: AppDeps): ApiApp {
  const app = new Hono<ApiEnv>();

  app.use('*', async (c, next) => {
    c.set('correlationId', resolveCorrelationId(c.req.header(CORRELATION_ID_HEADER)));
    await next();
    for (const [name, value] of SECURITY_HEADERS) {
      c.res.headers.set(name, value);
    }
    c.res.headers.set(CORRELATION_ID_HEADER, c.get('correlationId'));
    if (deps.config.appEnv !== 'local') {
      c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });

  app.get(HEALTH_PATH, (c) => c.json({ status: 'ok' }));

  // Registered after the health route, which answers without calling `next`, so only the routes below need a session.
  app.use(`${API_BASE_PATH}/*`, requireSession(deps.verify), requireTenantAccess(deps.db));

  mountEndpoints(app, handlers, { config: deps.config, db: deps.db, now: deps.now ?? (() => new Date()) });

  app.notFound((c) => problemResponse(new HttpProblem(404, `No endpoint ${c.req.method} ${c.req.path}.`), c.get('correlationId')));
  app.onError((error, c) => {
    const correlationId = c.get('correlationId') ?? resolveCorrelationId(null);
    if (error instanceof HttpProblem) {
      return problemResponse(error, correlationId);
    }
    console.error(`API failure ${correlationId} on ${c.req.method} ${c.req.path}:`, error instanceof Error ? error.message : 'unknown error');
    return problemResponse(new HttpProblem(500, 'The server failed on this request.'), correlationId);
  });
  return app;
}

/** The app over the process configuration, the shared database client and the real token verifier. */
export function buildDefaultApp(): ApiApp {
  return buildApp({ config: getConfig(), db: getDb(), verify: verifyAccessToken });
}
