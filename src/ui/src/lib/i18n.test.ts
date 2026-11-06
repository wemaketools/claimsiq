import { describe, expect, it } from 'vitest';

import {
  RESERVED_NAMESPACES,
  featureNamespaceOf,
  hasTranslation,
  registerCatalog,
  t,
} from './i18n';

describe('t', () => {
  it('interpolates named parameters', () => {
    expect(t('shell.footer.currency', { currency: 'BWP' })).toBe('All amounts in BWP');
  });

  it('chooses the English plural form from count', () => {
    expect(t('ui.table.selected', { count: 1 })).toBe('1 selected');
    expect(t('ui.table.selected', { count: 3 })).toBe('3 selected');
  });

  it('returns the key itself for a missing translation', () => {
    expect(t('no.such.key')).toBe('no.such.key');
    expect(hasTranslation('no.such.key')).toBe(false);
  });

  it('namespaces feature catalogs by their directory and flattens nested keys', () => {
    registerCatalog('testfeature', { list: { title: 'Claims {count}' }, 'flat.key': 'Flat' });
    expect(t('testfeature.list.title', { count: 3 })).toBe('Claims 3');
    expect(t('testfeature.flat.key')).toBe('Flat');
    expect(featureNamespaceOf('../features/claim-handling/i18n/en.ts')).toBe('claim-handling');
    expect(featureNamespaceOf('../features/x/other.ts')).toBeNull();
  });
});

describe('reserved namespaces', () => {
  it('leaves the feature directory names of the six screens free', () => {
    const features = ['overview', 'stages', 'exceptions', 'claims', 'suppliers', 'actions'];

    const clashes = features.filter((name) =>
      (RESERVED_NAMESPACES as readonly string[]).includes(name),
    );

    expect(clashes).toEqual([]);
  });
});

describe('shell catalog coverage', () => {
  const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('has a translation for every literal key the app passes to t()', () => {
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
