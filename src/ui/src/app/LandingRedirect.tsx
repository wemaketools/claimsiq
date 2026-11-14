/**
 * The element of `/`: the active persona's screen, or the first sidebar destination when that screen is not registered.
 */
import { Navigate } from 'react-router';

import { usePersona } from './hooks';
import { PERSONA_LANDING } from './personas';

export function LandingRedirect({ destinations }: { readonly destinations: readonly string[] }) {
  const landing = PERSONA_LANDING[usePersona()];
  return (
    <Navigate to={destinations.includes(landing) ? landing : (destinations[0] ?? '/')} replace />
  );
}
