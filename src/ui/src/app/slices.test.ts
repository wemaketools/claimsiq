import { describe, expect, it } from 'vitest';

import { chooseTheme, choosePersona } from './sessionActions';
import { filtersChanged, filtersCleared, filtersReplaced } from './slices/filters';
import { authSignedIn, signedOut } from './slices/session';
import { createAppStore } from './store';

describe('store', () => {
  it('keeps the persona and theme across sign-out and visits, and resets screen filters on sign-out', () => {
    const store = createAppStore();
    expect(store.getState().session).toMatchObject({
      authStatus: 'initializing',
      persona: 'head-of-claims',
      theme: 'light',
    });

    store.dispatch(authSignedIn({ user: { id: 'u1', email: null, fullName: 'Finance' } }));
    store.dispatch(choosePersona('supplier-coordinator'));
    store.dispatch(chooseTheme('dark'));
    store.dispatch(filtersChanged({ screen: 'CLM-02', values: { stage: 'new' } }));
    store.dispatch(filtersChanged({ screen: 'CLM-02', values: { q: 'roof' } }));
    expect(store.getState().filters.byScreen['CLM-02']).toEqual({ stage: 'new', q: 'roof' });
    store.dispatch(filtersReplaced({ screen: 'CLM-02', values: { owner: 'me' } }));
    expect(store.getState().filters.byScreen['CLM-02']).toEqual({ owner: 'me' });
    store.dispatch(filtersCleared({ screen: 'CLM-02' }));
    expect(store.getState().filters.byScreen['CLM-02']).toBeUndefined();
    store.dispatch(filtersChanged({ screen: 'CLM-02', values: { stage: 'new' } }));

    store.dispatch(signedOut('expired'));

    expect(store.getState().session).toMatchObject({
      authStatus: 'signedOut',
      user: null,
      signOutReason: 'expired',
      persona: 'supplier-coordinator',
      theme: 'dark',
    });
    expect(store.getState().filters.byScreen).toEqual({});
    expect(createAppStore().getState().session).toMatchObject({
      persona: 'supplier-coordinator',
      theme: 'dark',
    });

    window.localStorage.setItem('ciq.persona', 'ceo');
    expect(createAppStore().getState().session.persona).toBe('head-of-claims');
  });
});
