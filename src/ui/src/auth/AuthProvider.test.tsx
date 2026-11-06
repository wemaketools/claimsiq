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
import { useAuth } from './authContext';
import { AuthProvider } from './AuthProvider';

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

const mocks = vi.hoisted(() => ({
  listeners: [] as Array<(event: string, session: unknown) => void>,
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
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
  return (
    <>
      <p data-testid="status">
        {status.authStatus} {status.user?.fullName ?? 'nobody'} {status.theme}{' '}
        {status.signOutReason ?? '-'}
      </p>
      <button type="button" onClick={() => void auth.signIn('a@b.c', 'pw')}>
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
      <AuthProvider store={store}>
        <Probe />
      </AuthProvider>
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
});

describe('AuthProvider', () => {
  it('puts the signed-in user in the session slice and applies the stored theme', () => {
    window.localStorage.setItem('ciq.theme', 'dark');
    renderProvider();

    act(() => emit('INITIAL_SESSION', session));

    expect(screen.getByTestId('status')).toHaveTextContent('signedIn Finance dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('falls back to the email address when the account has no full name', () => {
    renderProvider();

    act(() =>
      emit('SIGNED_IN', {
        ...session,
        user: { id: 'auth-2', email: 'x@claimsiq.local', user_metadata: {} },
      } as unknown as Session),
    );

    expect(screen.getByTestId('status')).toHaveTextContent('signedIn x@claimsiq.local');
  });

  it('sends the session token and the tenant on API calls', async () => {
    const { requests } = installFetch({ 'GET /api/v1/ping': () => ({ body: { ok: true } }) });
    renderProvider();
    act(() => emit('INITIAL_SESSION', session));

    act(() => screen.getByRole('button', { name: 'ping' }).click());

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.headers.authorization).toBe('Bearer jwt-from-session');
    expect(requests[0]?.headers['x-tenant-id']).toBe('DEMO');
  });

  it('signs the user out when the API answers 401', async () => {
    installFetch({ 'GET /api/v1/ping': () => problem(401, 'Unauthenticated') });
    renderProvider();
    act(() => emit('INITIAL_SESSION', session));

    act(() => screen.getByRole('button', { name: 'ping' }).click());

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('signedOut nobody light expired'),
    );
  });

  it('reports a failed sign-in as a single generic result and signs out on request', async () => {
    installFetch({});
    mocks.signInWithPassword.mockResolvedValue({ error: new Error('Invalid login credentials') });
    renderProvider();
    act(() => emit('INITIAL_SESSION', null));
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');

    act(() => screen.getByRole('button', { name: 'sign in' }).click());
    await waitFor(() =>
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.c', password: 'pw' }),
    );
    act(() => screen.getByRole('button', { name: 'sign out' }).click());

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('signedOut nobody light user'),
    );
  });
});
