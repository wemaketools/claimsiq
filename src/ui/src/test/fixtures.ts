import type { SessionState, SessionUser } from '../app/slices/session';

export function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'head.of.claims@claimsiq.local',
    fullName: 'Head of Claims',
    ...overrides,
  };
}

export function signedInSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    authStatus: 'signedIn',
    user: makeUser(),
    persona: 'head-of-claims',
    theme: 'light',
    signOutReason: null,
    ...overrides,
  };
}

export function signedOutSession(overrides: Partial<SessionState> = {}): SessionState {
  return signedInSession({ authStatus: 'signedOut', user: null, ...overrides });
}
