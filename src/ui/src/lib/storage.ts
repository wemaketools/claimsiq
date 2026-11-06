/**
 * localStorage for conveniences only: the persona view, the theme, the data set and the as-of date. Nothing here is
 * trusted or required (the changes made on top of a fixture are the mock API's, in its own keys).
 * Every access is guarded, because storage can be unavailable (private mode, blocked site data).
 */
import { DEFAULT_AS_OF, isDataSetId, isRealDate } from '../../../contracts/index';
import type { DataSetId } from '../../../contracts/index';
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

/** The data set the user last chose, or `null`; an unknown stored value is ignored. */
export function readStoredDataSet(): DataSetId | null {
  const raw = read('dataSet');
  return isDataSetId(raw) ? raw : null;
}

export function storeDataSet(dataSet: DataSetId): void {
  write('dataSet', dataSet);
}

/** The as-of date the user last chose, or `null`; a value that is not a real date is ignored. */
export function readStoredAsOf(): string | null {
  const raw = read('asOf');
  return raw !== null && isRealDate(raw) ? raw : null;
}

export function storeAsOf(asOf: string): void {
  write('asOf', asOf === DEFAULT_AS_OF ? null : asOf);
}
