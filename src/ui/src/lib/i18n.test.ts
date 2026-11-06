import { describe, expect, it } from 'vitest';

import {
  RESERVED_NAMESPACES,
  featureNamespaceOf,
  hasTranslation,
  registerCatalog,
  t,
} from './i18n';

describe('translation', () => {
  it('interpolates, picks plural forms, shows a missing key as itself and namespaces feature catalogs', () => {
    expect(t('shell.footer.currency', { currency: 'BWP' })).toBe('All amounts in BWP');
    expect(t('ui.table.selected', { count: 1 })).toBe('1 selected');
    expect(t('ui.table.selected', { count: 3 })).toBe('3 selected');
    expect(t('no.such.key')).toBe('no.such.key');
    expect(hasTranslation('no.such.key')).toBe(false);

    registerCatalog('testfeature', { list: { title: 'Claims {count}' }, 'flat.key': 'Flat' });
    expect(t('testfeature.list.title', { count: 3 })).toBe('Claims 3');
    expect(t('testfeature.flat.key')).toBe('Flat');
    expect(featureNamespaceOf('../features/claim-handling/i18n/en.ts')).toBe('claim-handling');
    expect(featureNamespaceOf('../features/x/other.ts')).toBeNull();
    for (const feature of ['overview', 'stages', 'exceptions', 'claims', 'suppliers', 'actions']) {
      expect(RESERVED_NAMESPACES as readonly string[]).not.toContain(feature);
    }
  });

  it('has a translation for every literal key the app passes to t()', () => {
    const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    const missing: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      for (const match of text.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) {
        const key = match[1] ?? '';
        if (key.split('.').length > 1 && !hasTranslation(key) && !file.endsWith('i18n.ts')) {
          missing.push(`${file}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
