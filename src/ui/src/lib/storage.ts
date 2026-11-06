/**
 * localStorage for conveniences only: the persona view and the theme. Nothing here is trusted or required.
 * Every access is guarded, because storage can be unavailable (private mode, blocked site data).
 */
import { isPersonaId } from '../app/personas';
import type { PersonaId } from '../app/personas';

const PREFIX = 'ciq.';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(PREFIX + key);
    } else {
      window.localStorage.setItem(PREFIX + key, value);
    }
  } catch {
    // Storage unavailable: the convenience is simply lost.
  }
}

export type StoredTheme = 'light' | 'dark';

/** The last chosen theme, or `null` before the user chose one. */
export function readStoredTheme(): StoredTheme | null {
  const raw = read('theme');
  return raw === 'light' || raw === 'dark' ? raw : null;
}

export function storeTheme(theme: StoredTheme): void {
  write('theme', theme);
}

/** The persona the user last switched to, or `null`; an unknown stored value is ignored. */
export function readStoredPersona(): PersonaId | null {
  const raw = read('persona');
  return isPersonaId(raw) ? raw : null;
}

export function storePersona(persona: PersonaId): void {
  write('persona', persona);
}
