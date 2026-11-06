/** Unit tests of the JWKS cache (src/server/lib/supabase/jwks.ts), with an injected fetch and clock. */
import { describe, expect, it, vi } from 'vitest';

import { JwksUnavailableError, createJwksCache } from '../../../lib/supabase/jwks.js';

const EC_KEY = { kty: 'EC', kid: 'k1', crv: 'P-256', x: 'x', y: 'y', alg: 'ES256', key_ops: ['verify'] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function setup(responses: Array<Response | Error>, retryBackoffMs = 0) {
  let clock = 1_000_000;
  const fetchMock = vi.fn(async () => {
    const next = responses.shift();
    if (next === undefined) {
      throw new Error('no more responses');
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });
  const cache = createJwksCache({
    url: 'http://auth.test/auth/v1/.well-known/jwks.json',
    fetch: fetchMock as unknown as typeof fetch,
    now: () => clock,
    ttlMs: 1000,
    maxStaleMs: 5000,
    retryBackoffMs,
  });
  return { cache, fetchMock, advance: (ms: number) => (clock += ms) };
}

describe('createJwksCache', () => {
  it('fetches once, rejects an unknown kid without another request, refetches after the TTL so a rotated key is known, and keeps only public asymmetric keys', async () => {
    const rotated = { ...EC_KEY, kid: 'k2' };
    const { cache, fetchMock, advance } = setup([
      jsonResponse({
        keys: [
          EC_KEY,
          { ...EC_KEY, kid: 'private', d: 'secret-part' },
          { kty: 'oct', kid: 'symmetric', k: 'c2VjcmV0' },
        ],
      }),
      jsonResponse({ keys: [rotated] }),
    ]);

    const concurrent = await Promise.all([cache.getKey('k1'), cache.getKey('k1'), cache.getKey('k1')]);

    expect(concurrent.every((key) => key?.kid === 'k1')).toBe(true);
    expect(await cache.getKey('forged-kid')).toBeNull();
    expect(await cache.getKey('private')).toBeNull();
    expect(await cache.getKey('symmetric')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    advance(1500);

    expect(await cache.getKey('k2')).toMatchObject({ kid: 'k2' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serves the stale set during an outage without hammering the network, retries after the back-off, and fails fast with nothing cached', async () => {
    const { cache, fetchMock, advance } = setup(
      [jsonResponse({ keys: [EC_KEY] }), new Error('network down'), new Error('still down')],
      1000,
    );
    await cache.getKey('k1');
    advance(1500);

    expect(await cache.getKey('k1')).toMatchObject({ kid: 'k1' });
    advance(100);
    await cache.getKey('k1');
    await cache.getKey('k1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    advance(1000);
    expect(await cache.getKey('k1')).toMatchObject({ kid: 'k1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const empty = setup([new Error('down'), jsonResponse({ error: 'x' }, 503)], 60_000);
    await expect(empty.cache.getKey('k1')).rejects.toBeInstanceOf(JwksUnavailableError);
    await expect(empty.cache.getKey('k1')).rejects.toBeInstanceOf(JwksUnavailableError);
    expect(empty.fetchMock).toHaveBeenCalledTimes(2);
  });
});
