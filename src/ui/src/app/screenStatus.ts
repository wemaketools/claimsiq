/**
 * The state of a screen that has no data behind it yet: `loading` until its loader settles, then `empty`, or
 * `error` when the loader fails. Screens that fetch real data use `useApiQuery` instead and drop this hook.
 *
 * `configureScreenLoader` installs the loader (the default resolves at once); tests use it to hold a screen in
 * `loading` or to fail it.
 */
import { useCallback, useEffect, useState } from 'react';

import { ApiError, isApiError } from '../api/client';

export type ScreenLoader = (screen: string, signal: AbortSignal) => Promise<void>;

let loader: ScreenLoader = () => Promise.resolve();

/** Installs the loader. Returns a function restoring the previous one. */
export function configureScreenLoader(next: ScreenLoader): () => void {
  const previous = loader;
  loader = next;
  return () => {
    loader = previous;
  };
}

export type ScreenStatus =
  | { readonly state: 'loading' }
  | { readonly state: 'empty' }
  | { readonly state: 'error'; readonly error: ApiError };

export interface ScreenStatusResult {
  readonly status: ScreenStatus;
  readonly reload: () => void;
}

function toApiError(screen: string, error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }
  return new ApiError({
    kind: 'network',
    status: 0,
    title: error instanceof Error ? error.message : 'The screen could not be loaded.',
    endpointId: screen,
  });
}

export function useScreenStatus(screen: string): ScreenStatusResult {
  const [status, setStatus] = useState<ScreenStatus>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loader(screen, controller.signal).then(
      () => {
        if (!controller.signal.aborted) setStatus({ state: 'empty' });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setStatus({ state: 'error', error: toApiError(screen, error) });
        }
      },
    );
    return () => controller.abort();
  }, [screen, attempt]);

  const reload = useCallback(() => {
    setStatus({ state: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  return { status, reload };
}
