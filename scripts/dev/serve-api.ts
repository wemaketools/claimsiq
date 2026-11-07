/**
 * `bun run dev:api`: the same Hono app the Vercel function serves, over node:http on 127.0.0.1:API_PORT (default 5274).
 * The Vite dev server proxies `/api` to it. Reads the environment through the typed config only (`.env.local` is loaded
 * by Bun). Stop it with Ctrl+C.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

import { getConfig } from '../../src/server/lib/config/index.js';
import { closeDb } from '../../src/server/lib/db/index.js';
import { API_BASE_PATH, buildDefaultApp } from '../../src/server/lib/router/app.js';

function toWebRequest(req: IncomingMessage, origin: string): Request {
  const method = req.method ?? 'GET';
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    for (const single of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      headers.append(name, single);
    }
  }
  const hasBody = method !== 'GET' && method !== 'HEAD';
  return new Request(new URL(req.url ?? '/', origin), {
    method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: 'half' } : {}),
  } as RequestInit);
}

async function writeWebResponse(response: Response, res: ServerResponse): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function main(): void {
  const config = getConfig();
  const app = buildDefaultApp();
  const origin = `http://127.0.0.1:${config.apiPort}`;

  const server = createServer((req, res) => {
    void (async () => {
      try {
        await writeWebResponse(await app.fetch(toWebRequest(req, origin)), res);
      } catch (error) {
        console.error('API runner failed on a request:', error instanceof Error ? error.message : 'unknown error');
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('Internal Server Error');
      }
    })();
  });

  const stop = (): void => {
    server.close();
    void closeDb().finally(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  server.listen(config.apiPort, '127.0.0.1', () => {
    process.stdout.write(`ClaimsIQ API listening on ${origin}${API_BASE_PATH} (health: ${origin}${API_BASE_PATH}/health)\n`);
  });
}

main();
