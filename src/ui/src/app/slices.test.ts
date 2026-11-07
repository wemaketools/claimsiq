import { describe, expect, it } from 'vitest';

import { chooseAsOf, chooseDataSet } from './dataContextActions';
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

  it('keeps the data set, as-of date and screen filters across visits, clears the filters when the data set changes, and ignores stored values that are not valid', () => {
    const store = createAppStore();
    expect(store.getState().dataContext).toEqual({ dataSet: 'DEMO', asOf: '2026-10-21' });

    store.dispatch(filtersChanged({ screen: 'CLM-02', values: { broker: 'BRK-01' } }));
    store.dispatch(chooseAsOf('2026-10-05'));
    expect(store.getState().filters.byScreen['CLM-02']).toEqual({ broker: 'BRK-01' });
    expect(createAppStore().getState().filters.byScreen).toEqual({
      'CLM-02': { broker: 'BRK-01' },
    });
    store.dispatch(chooseDataSet('TEST'));

    expect(store.getState().filters.byScreen).toEqual({});
    expect(createAppStore().getState().filters.byScreen).toEqual({});
    window.localStorage.setItem('ciq.filters', '{"claim-scope":{"broker_id":{"x":1}}}');
    expect(createAppStore().getState().filters.byScreen).toEqual({});
    expect(createAppStore().getState().dataContext).toEqual({
      dataSet: 'TEST',
      asOf: '2026-10-05',
    });

    store.dispatch(chooseAsOf('2026-10-21'));
    expect(window.localStorage.getItem('ciq.asOf')).toBeNull();
    window.localStorage.setItem('ciq.dataSet', 'PROD');
    window.localStorage.setItem('ciq.asOf', '2026-02-30');
    expect(createAppStore().getState().dataContext).toEqual({
      dataSet: 'DEMO',
      asOf: '2026-10-21',
    });
  });
});
