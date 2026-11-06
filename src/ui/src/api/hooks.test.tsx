import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { installFetch, problem } from '../test/fetchMock';
import { signedInSession } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import type { ApiEndpoint } from './endpoint';
import { invalidateApiQueries, useApiMutation, useApiQuery } from './hooks';

const summary: ApiEndpoint<{ open: number }> = {
  id: 'claims.summary',
  method: 'GET',
  path: '/api/v1/claims/summary',
  response: z.object({ open: z.number() }),
};

const closeAll: ApiEndpoint<{ closed: number }> = {
  id: 'claims.closeAll',
  method: 'POST',
  path: '/api/v1/claims/close-all',
  response: z.object({ closed: z.number() }),
};

function Summary() {
  const query = useApiQuery(summary, {});
  if (query.status === 'loading') return <p>loading</p>;
  if (query.status === 'error') return <p>error {query.error?.status}</p>;
  return (
    <p>
      open {query.data?.open} {query.isFetching ? 'fetching' : 'idle'}
    </p>
  );
}

describe('useApiQuery', () => {
  it('shows loading, then the data', async () => {
    installFetch({ 'GET /api/v1/claims/summary': () => ({ body: { open: 4 } }) });
    renderWithProviders(<Summary />, { state: { session: signedInSession() } });

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('open 4 idle')).toBeInTheDocument();
  });

  it('exposes the normalized error', async () => {
    installFetch({ 'GET /api/v1/claims/summary': () => problem(403, 'Forbidden') });
    renderWithProviders(<Summary />, { state: { session: signedInSession() } });

    expect(await screen.findByText('error 403')).toBeInTheDocument();
  });

  it('re-runs when its endpoint is invalidated', async () => {
    let open = 1;
    installFetch({ 'GET /api/v1/claims/summary': () => ({ body: { open } }) });
    renderWithProviders(<Summary />, { state: { session: signedInSession() } });
    expect(await screen.findByText('open 1 idle')).toBeInTheDocument();

    open = 5;
    act(() => invalidateApiQueries('claims.'));

    expect(await screen.findByText('open 5 idle')).toBeInTheDocument();
  });

  it('does not re-run when another endpoint is invalidated', async () => {
    let open = 1;
    installFetch({ 'GET /api/v1/claims/summary': () => ({ body: { open } }) });
    renderWithProviders(<Summary />, { state: { session: signedInSession() } });
    expect(await screen.findByText('open 1 idle')).toBeInTheDocument();

    open = 5;
    act(() => invalidateApiQueries('suppliers.'));

    expect(screen.getByText('open 1 idle')).toBeInTheDocument();
  });
});

function CloseButton() {
  const mutation = useApiMutation(closeAll);
  return (
    <>
      <button
        type="button"
        disabled={mutation.pending}
        onClick={() => void mutation.mutate({ body: {} }).catch(() => undefined)}
      >
        close
      </button>
      {mutation.data !== undefined && <p>closed {mutation.data.closed}</p>}
      {mutation.error !== null && <p>failed {mutation.error.status}</p>}
    </>
  );
}

function Overlapping() {
  const mutation = useApiMutation(closeAll);
  return (
    <>
      <button
        type="button"
        onClick={() => void mutation.mutate({ body: {} }).catch(() => undefined)}
      >
        close
      </button>
      <p>{mutation.pending ? 'pending' : 'idle'}</p>
      {mutation.data !== undefined && <p>closed {mutation.data.closed}</p>}
    </>
  );
}

describe('useApiMutation', () => {
  it('stays pending until the last of two overlapping commands has finished', async () => {
    const releases: Array<() => void> = [];
    installFetch({
      'POST /api/v1/claims/close-all': async () => {
        await new Promise<void>((resolve) => releases.push(resolve));
        return { body: { closed: releases.length } };
      },
    });
    renderWithProviders(<Overlapping />, { state: { session: signedInSession() } });
    await userEvent.click(screen.getByRole('button', { name: 'close' }));
    await userEvent.click(screen.getByRole('button', { name: 'close' }));
    await waitFor(() => expect(releases).toHaveLength(2));

    await act(async () => releases[0]?.());
    expect(screen.getByText('pending')).toBeInTheDocument();

    await act(async () => releases[1]?.());
    expect(await screen.findByText('idle')).toBeInTheDocument();
  });

  it('keeps the response of a command', async () => {
    installFetch({ 'POST /api/v1/claims/close-all': () => ({ body: { closed: 3 } }) });
    renderWithProviders(<CloseButton />, { state: { session: signedInSession() } });

    await userEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(await screen.findByText('closed 3')).toBeInTheDocument();
  });

  it('keeps the error of a failed command', async () => {
    installFetch({ 'POST /api/v1/claims/close-all': () => problem(500, 'Internal') });
    renderWithProviders(<CloseButton />, { state: { session: signedInSession() } });

    await userEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(await screen.findByText('failed 500')).toBeInTheDocument();
  });
});
