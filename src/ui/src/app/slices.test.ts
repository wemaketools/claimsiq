import { describe, expect, it } from 'vitest';

import { signedInSession } from '../test/fixtures';
import { chooseTheme, choosePersona } from './sessionActions';
import { filtersChanged, filtersCleared, filtersReplaced } from './slices/filters';
import { authSignedIn, signedOut } from './slices/session';
import { createAppStore } from './store';

describe('session slice', () => {
  it('starts initializing with the default persona and the light theme', () => {
    const { session } = createAppStore().getState();

    expect(session).toMatchObject({
      authStatus: 'initializing',
      user: null,
      persona: 'head-of-claims',
      theme: 'light',
    });
  });

  it('keeps the signed-in user until sign-out, and records why the user signed out', () => {
    const store = createAppStore();

    store.dispatch(authSignedIn({ user: { id: 'u1', email: null, fullName: 'Finance' } }));
    expect(store.getState().session).toMatchObject({ authStatus: 'signedIn' });

    store.dispatch(signedOut('expired'));
    expect(store.getState().session).toMatchObject({
      authStatus: 'signedOut',
      user: null,
      signOutReason: 'expired',
    });
  });

  it('keeps the persona and the theme across a sign-out', () => {
    const store = createAppStore({ session: signedInSession() });
    store.dispatch(choosePersona('finance'));
    store.dispatch(chooseTheme('dark'));

    store.dispatch(signedOut('user'));

    expect(store.getState().session).toMatchObject({ persona: 'finance', theme: 'dark' });
  });

  it('restores the persona and the theme of the previous visit', () => {
    const first = createAppStore();
    first.dispatch(choosePersona('supplier-coordinator'));
    first.dispatch(chooseTheme('dark'));

    const second = createAppStore();

    expect(second.getState().session).toMatchObject({
      persona: 'supplier-coordinator',
      theme: 'dark',
    });
  });
});

describe('filters slice', () => {
  it('merges, replaces and clears the filters of one screen', () => {
    const store = createAppStore();

    store.dispatch(filtersChanged({ screen: 'CLM-02', values: { stage: 'new' } }));
    store.dispatch(filtersChanged({ screen: 'CLM-02', values: { q: 'roof' } }));
    expect(store.getState().filters.byScreen['CLM-02']).toEqual({ stage: 'new', q: 'roof' });

    store.dispatch(filtersReplaced({ screen: 'CLM-02', values: { owner: 'me' } }));
    expect(store.getState().filters.byScreen['CLM-02']).toEqual({ owner: 'me' });

    store.dispatch(filtersCleared({ screen: 'CLM-02' }));
    expect(store.getState().filters.byScreen['CLM-02']).toBeUndefined();
  });

  it('resets every screen on sign-out', () => {
    const store = createAppStore();
    store.dispatch(filtersChanged({ screen: 'CLM-02', values: { stage: 'new' } }));

    store.dispatch(signedOut('user'));

    expect(store.getState().filters.byScreen).toEqual({});
  });
});
