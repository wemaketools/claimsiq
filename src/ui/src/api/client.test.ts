import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { installFetch, problem } from '../test/fetchMock';
import { ApiError, call, configureApiClient, fieldErrorsFor } from './client';
import type { ApiEndpoint } from './endpoint';

const restores: Array<() => void> = [];
function adapters(
  options: { tenant?: string | null; onUnauthorized?: () => void; token?: string | null } = {},
) {
  restores.push(
    configureApiClient({
      getAccessToken: () => Promise.resolve(options.token === undefined ? 'jwt-1' : options.token),
      getTenantId: () => (options.tenant === undefined ? 'tenant-a' : options.tenant),
      onUnauthorized: options.onUnauthorized ?? (() => undefined),
    }),
  );
}
afterEach(() => {
  while (restores.length > 0) restores.pop()?.();
});

const health: ApiEndpoint<{ ok: boolean }> = {
  id: 'test.health',
  method: 'GET',
  path: '/api/v1/test-health',
  public: true,
  response: z.object({ ok: z.boolean() }),
};

const claim: ApiEndpoint<{ id: number }> = {
  id: 'test.claim',
  method: 'GET',
  path: '/api/v1/test-claims/:claimId',
  response: z.object({ id: z.number() }),
};

const closeClaim: ApiEndpoint<{ closed: boolean }> = {
  id: 'test.closeClaim',
  method: 'POST',
  path: '/api/v1/test-claims/:claimId/close',
  idempotent: true,
  response: z.object({ closed: z.boolean() }),
};

describe('call: requests', () => {
  it('sends the bearer token and the tenant, and fills the path and the query', async () => {
    adapters();
    const { requests } = installFetch({
      'GET /api/v1/test-claims/3': () => ({ body: { id: 3 } }),
    });

    const result = await call(claim, {
      params: { claimId: 3 },
      query: { stage: ['new', 'triage'], q: 'roof', empty: undefined },
    });

    expect(result).toEqual({ id: 3 });
    expect(requests[0]?.search).toBe('?stage=new&stage=triage&q=roof');
    expect(requests[0]?.headers.authorization).toBe('Bearer jwt-1');
    expect(requests[0]?.headers['x-tenant-id']).toBe('tenant-a');
  });

  it('omits the token and the tenant on public endpoints', async () => {
    adapters();
    const { requests } = installFetch({
      'GET /api/v1/test-health': () => ({ body: { ok: true } }),
    });

    await call(health);

    expect(requests[0]?.headers.authorization).toBeUndefined();
    expect(requests[0]?.headers['x-tenant-id']).toBeUndefined();
  });

  it('sends no tenant header when no tenant is known', async () => {
    adapters({ tenant: null });
    const { requests } = installFetch({
      'GET /api/v1/test-claims/1': () => ({ body: { id: 1 } }),
    });

    await call(claim, { params: { claimId: 1 } });

    expect(requests[0]?.headers['x-tenant-id']).toBeUndefined();
  });

  it('sends the given idempotency key, or a generated one, on idempotent commands', async () => {
    adapters();
    const { requests } = installFetch({
      'POST /api/v1/test-claims/5/close': () => ({ body: { closed: true } }),
    });

    await call(closeClaim, { params: { claimId: 5 }, body: {} }, { idempotencyKey: 'key-1' });
    await call(closeClaim, { params: { claimId: 5 }, body: {} });

    expect(requests[0]?.headers['idempotency-key']).toBe('key-1');
    expect(requests[1]?.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuses a path whose parameter is missing', async () => {
    adapters();
    installFetch({});

    await expect(call(claim)).rejects.toThrow('Missing path parameter "claimId"');
  });
});

describe('call: responses', () => {
  it('normalizes problem+json into status, title, field errors and correlation id', async () => {
    adapters();
    installFetch({
      'POST /api/v1/test-claims/5/close': () =>
        problem(422, 'Validation failed', {
          code: 'VALIDATION_FAILED',
          errors: [{ field: 'reason', code: 'REQUIRED', message: 'Give a reason.' }],
        }),
    });

    const error = await call(closeClaim, { params: { claimId: 5 }, body: {} }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.kind).toBe('validation');
    expect(apiError.correlationId).toBe('corr-test-1');
    expect(fieldErrorsFor(apiError, 'reason')).toHaveLength(1);
  });

  it('signs out on 401', async () => {
    const onUnauthorized = vi.fn();
    adapters({ onUnauthorized });
    installFetch({ 'GET /api/v1/test-claims/1': () => problem(401, 'Unauthenticated') });

    await expect(call(claim, { params: { claimId: 1 } })).rejects.toMatchObject({
      kind: 'unauthenticated',
    });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('returns null for 204', async () => {
    adapters();
    installFetch({ 'GET /api/v1/test-claims/1': () => ({ status: 204 }) });

    await expect(call(claim, { params: { claimId: 1 } })).resolves.toBeNull();
  });

  it('rejects a response that drifts from the schema in development builds', async () => {
    adapters();
    installFetch({ 'GET /api/v1/test-claims/1': () => ({ body: { id: 'one' } }) });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(call(claim, { params: { claimId: 1 } })).rejects.toMatchObject({
      kind: 'contract',
    });
  });

  it('reports a network failure as a network error', async () => {
    adapters();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    await expect(call(claim, { params: { claimId: 1 } })).rejects.toMatchObject({
      kind: 'network',
      status: 0,
    });
  });

  it('keeps a non-problem error status with the correlation header', async () => {
    adapters();
    installFetch({
      'GET /api/v1/test-claims/1': () => ({
        status: 500,
        body: 'oops',
        headers: { 'x-correlation-id': 'corr-9' },
      }),
    });

    await expect(call(claim, { params: { claimId: 1 } })).rejects.toMatchObject({
      kind: 'server',
      correlationId: 'corr-9',
    });
  });
});
