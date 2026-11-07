/**
 * Subscribes to a CSS media query (the shell is an icon rail below 1280px by CSS alone and a drawer below 768px).
 */
import { useCallback, useSyncExternalStore } from 'react';

export const DRAWER_QUERY = '(max-width: 767px)';

function media(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = media(query);
      if (list === null) {
        return () => undefined;
      }
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => media(query)?.matches ?? false,
    () => false,
  );
}
