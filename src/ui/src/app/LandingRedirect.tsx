/**
 * The element of `/`: the active persona's screen, or the first sidebar destination when that screen is not registered.
 * The one reader of `PERSONA_LANDING`: sign-in and the persona switch open `/` and never pick a screen themselves.
 */
import { Navigate } from 'react-router';

import { usePersona } from './hooks';
import { PERSONA_LANDING } from './personas';

export const LANDING_ROUTE = '/';

export function LandingRedirect({ destinations }: { readonly destinations: readonly string[] }) {
  const landing = PERSONA_LANDING[usePersona()];
  return (
    <Navigate to={destinations.includes(landing) ? landing : (destinations[0] ?? '/')} replace />
  );
}
