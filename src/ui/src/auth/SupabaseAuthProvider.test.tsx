import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { z } from 'zod';

import type { ApiEndpoint } from '../api/endpoint';
import { useAppSelector } from '../app/hooks';
import { createAppStore } from '../app/store';
import { call } from '../api/client';
import { installFetch, problem } from '../test/fetchMock';
import { useState } from 'react';

import {
  DEMO_SIGN_IN_NOT_CONFIGURED_CODE,
  DEMO_SIGN_IN_REFUSED_CODE,
} from '../../../contracts/index';
import { useAuth } from './authContext';
import { SupabaseAuthProvider } from './SupabaseAuthProvider';

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

const mocks = vi.hoisted(() => ({
  listeners: [] as Array<(event: string, session: unknown) => void>,
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  setSession: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
        mocks.listeners.push(listener);
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
      signOut: mocks.signOut,
      signInWithPassword: mocks.signInWithPassword,
      setSession: mocks.setSession,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      updateUser: mocks.updateUser,
    },
  },
  currentAccessToken: () => Promise.resolve('jwt-from-session'),
}));

function emit(event: AuthChangeEvent, session: Session | null): void {
  for (const listener of mocks.listeners as Listener[]) listener(event, session);
}

const session = {
  access_token: 'jwt',
  user: {
    id: 'auth-1',
    email: 'finance@claimsiq.local',
    user_metadata: { full_name: 'Finance' },
  },
} as unknown as Session;

const ping: ApiEndpoint<{ ok: boolean }> = {
  id: 'test.ping',
  method: 'GET',
  path: '/api/v1/ping',
  response: z.object({ ok: z.boolean() }),
};

function Probe() {
  const auth = useAuth();
  const status = useAppSelector((state) => state.session);
  const [demo, setDemo] = useState('none');
  return (
    <>
      <p data-testid="demo">{demo}</p>
      <button
        type="button"
        onClick={() =>
          void (auth.mode === 'supabase'
            ? auth
                .signInAsDemo('finance@claimsiq.local')
                .then((result) => setDemo(result.ok ? 'ok' : result.reason))
            : undefined)
        }
      >
        demo
      </button>
      <p data-testid="status">
        {status.authStatus} {status.user?.fullName ?? 'nobody'} {status.theme}{' '}
        {status.signOutReason ?? '-'}
      </p>
      <button
        type="button"
        onClick={() => void (auth.mode === 'supabase' ? auth.signIn('a@b.c', 'pw') : undefined)}
      >
        sign in
      </button>
      <button type="button" onClick={() => void auth.signOut()}>
        sign out
      </button>
      <button type="button" onClick={() => void call(ping).catch(() => undefined)}>
        ping
      </button>
    </>
  );
}

function renderProvider() {
  const store = createAppStore();
  render(
    <Provider store={store}>
      <SupabaseAuthProvider store={store}>
        <Probe />
      </SupabaseAuthProvider>
    </Provider>,
  );
  return store;
}

beforeEach(() => {
  mocks.listeners.length = 0;
  mocks.signOut.mockReset().mockImplementation(() => {
    emit('SIGNED_OUT', null);
    return Promise.resolve({ error: null });
  });
  mocks.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  mocks.setSession.mockReset().mockResolvedValue({ error: null });
});

describe('SupabaseAuthProvider', () => {
  it('follows the Supabase session into the store, sends the token and tenant on API calls and signs out on 401 or on request', async () => {
    window.localStorage.setItem('ciq.theme', 'dark');
    let pings = 0;
    const { requests } = installFetch({
      'GET /api/v1/ping': () => (++pings === 1 ? { body: { ok: true } } : problem(401, 'Expired')),
    });
    mocks.signInWithPassword.mockResolvedValue({ error: new Error('Invalid login credentials') });
    renderProvider();
    act(() => emit('INITIAL_SESSION', null));
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut nobody dark -');
    act(() => screen.getByRole('button', { name: 'sign in' }).click());
    await waitFor(() =>
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw' }),
    );

    act(() => emit('SIGNED_IN', session));

    expect(screen.getByTestId('status')).toHaveTextContent('signedIn Finance dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    act(() => screen.getByRole('button', { name: 'ping' }).click());
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.headers.authorization).toBe('Bearer jwt-from-session');
    expect(requests[0]?.headers['x-tenant-id']).toBe('DEMO');

    act(() => screen.getByRole('button', { name: 'ping' }).click());
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('signedOut nobody dark expired'),
    );

    act(() =>
      emit('SIGNED_IN', {
        ...session,
        user: { id: 'auth-2', email: 'x@claimsiq.local', user_metadata: {} },
      } as unknown as Session),
    );
    expect(screen.getByTestId('status')).toHaveTextContent('signedIn x@claimsiq.local');
    act(() => screen.getByRole('button', { name: 'sign out' }).click());
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('signedOut nobody dark user'),
    );
  });
});

describe('SupabaseAuthProvider demo sign-in', () => {
  it('sends only the email to the server, adopts the session it returns, and reports a missing password and a refusal apart', async () => {
    let answer = 0;
    const { requests } = installFetch({
      'POST /api/v1/auth/demo-sign-in': () =>
        [
          {
            body: {
              access_token: 'server-access',
              refresh_token: 'server-refresh',
              expires_at: 1_900_000_000,
            },
          },
          problem(503, 'Demo sign-in is not configured in this environment.', {
            code: DEMO_SIGN_IN_NOT_CONFIGURED_CODE,
          }),
          problem(403, 'Demo sign-in is not available for this account.', {
            code: DEMO_SIGN_IN_REFUSED_CODE,
          }),
        ][answer++] ?? problem(500, 'Unexpected'),
    });
    renderProvider();
    act(() => emit('INITIAL_SESSION', null));
    const demo = screen.getByRole('button', { name: 'demo' });

    act(() => demo.click());
    await waitFor(() => expect(screen.getByTestId('demo')).toHaveTextContent('ok'));
    expect(requests[0]?.body).toEqual({ email: 'finance@claimsiq.local' });
    expect(requests[0]?.headers.authorization).toBeUndefined();
    expect(requests[0]?.headers['x-tenant-id']).toBeUndefined();
    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: 'server-access',
      refresh_token: 'server-refresh',
    });

    act(() => demo.click());
    await waitFor(() => expect(screen.getByTestId('demo')).toHaveTextContent('not_configured'));
    act(() => demo.click());
    await waitFor(() => expect(screen.getByTestId('demo')).toHaveTextContent('failed'));
    expect(mocks.setSession).toHaveBeenCalledTimes(1);
  });
});
