/**
 * The Vercel function that serves the whole of /api/v1. Routing happens inside the Hono app
 * (`src/server/lib/router/app.ts`), never through per-route function files.
 *
 * NOT DEPLOYED: `.vercelignore` leaves `api/` out and `vercel.json` has no rewrite for it until a hosted database exists
 * (DD-59 lists what to restore).
 *
 * TRAP, from Vercel's routing: an `api/` file has no catch-all syntax outside Next.js, so the nested paths reach this
 * function only through an `/api/v1/:path*` rewrite in `vercel.json`. A rewrite picks the function and leaves the
 * request URL alone, so Hono still matches the real path.
 *
 * TRAP: Vercel's Node runtime ignores what a default export returns and expects the named method exports below; every
 * method the API answers has to be listed, or the platform answers 405 before the router sees the request.
 *
 * The app is built on first use and cached per cold start, so a bad configuration answers one sanitized 500 with the
 * cause in the log, not a crash at module load.
 */
import { handle } from 'hono/vercel';

import { CORRELATION_ID_HEADER, HttpProblem, problemResponse, resolveCorrelationId } from '../../src/server/lib/errors/index.js';
import { buildDefaultApp } from '../../src/server/lib/router/app.js';

export const config = { runtime: 'nodejs' } as const;

let cachedHandler: ((request: Request) => Response | Promise<Response>) | null = null;

async function serve(request: Request): Promise<Response> {
  try {
    cachedHandler ??= handle(buildDefaultApp());
    return await cachedHandler(request);
  } catch (error) {
    const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
    console.error(`API could not be built ${correlationId}:`, error instanceof Error ? error.message : 'unknown error');
    return problemResponse(new HttpProblem(500, 'The server is not configured correctly.'), correlationId);
  }
}

export const GET = serve;
export const POST = serve;
