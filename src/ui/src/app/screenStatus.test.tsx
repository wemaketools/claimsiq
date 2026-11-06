import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { ApiError } from '../api/client';
import { configureScreenLoader, useScreenStatus } from './screenStatus';

const restores: Array<() => void> = [];
afterEach(() => {
  while (restores.length > 0) restores.pop()?.();
});

function Probe() {
  const { status, reload } = useScreenStatus('test');
  return (
    <>
      <p>{status.state === 'error' ? `error ${status.error.title}` : status.state}</p>
      <button type="button" onClick={reload}>
        reload
      </button>
    </>
  );
}

describe('useScreenStatus', () => {
  it('is loading until the loader settles, then empty', async () => {
    let release: () => void = () => undefined;
    restores.push(
      configureScreenLoader(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      ),
    );
    render(<Probe />);
    expect(screen.getByText('loading')).toBeInTheDocument();

    await act(async () => release());

    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('shows the error of a failed loader and loads again on reload', async () => {
    let fail = true;
    restores.push(
      configureScreenLoader(() =>
        fail ? Promise.reject(new Error('Backend is down')) : Promise.resolve(),
      ),
    );
    render(<Probe />);
    expect(await screen.findByText('error Backend is down')).toBeInTheDocument();

    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'reload' }));

    expect(await screen.findByText('empty')).toBeInTheDocument();
  });

  it('keeps the title of an ApiError the loader rejects with', async () => {
    restores.push(
      configureScreenLoader(() =>
        Promise.reject(
          new ApiError({ kind: 'server', status: 500, title: 'Boom', endpointId: 'test' }),
        ),
      ),
    );
    render(<Probe />);

    expect(await screen.findByText('error Boom')).toBeInTheDocument();
  });
});
