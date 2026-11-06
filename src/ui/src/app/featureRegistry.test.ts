import { afterEach, describe, expect, it, vi } from 'vitest';

import { appPath, collectFeatures, features, navItemsFor } from './featureRegistry';
import type { FeatureModule } from './featureRegistry';

afterEach(() => {
  vi.restoreAllMocks();
});

const page = { load: () => Promise.resolve({ default: () => null }) };

function module(id: string, overrides: Partial<FeatureModule> = {}): FeatureModule {
  return {
    id,
    routes: [{ path: id, ...page }],
    nav: [{ id, label: `${id}.nav`, path: id, order: 1, icon: 'list' }],
    ...overrides,
  };
}

describe('collectFeatures', () => {
  it('collects the modules of every routes file in file order', () => {
    const collected = collectFeatures({
      '../features/b/routes.tsx': { features: [module('b')] },
      '../features/a/routes.tsx': { features: [module('a')] },
    });

    expect(collected.map((feature) => feature.id)).toEqual(['a', 'b']);
  });

  it('skips a file that does not export features and reports it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const collected = collectFeatures({
      '../features/a/routes.tsx': {},
      '../features/b/routes.tsx': { features: [module('b')] },
    });

    expect(collected.map((feature) => feature.id)).toEqual(['b']);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('must export "features'));
  });

  it('keeps the first of two modules with the same id', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const collected = collectFeatures({
      '../features/a/routes.tsx': { features: [module('same')] },
      '../features/b/routes.tsx': { features: [module('same', { routes: [] })] },
    });

    expect(collected).toHaveLength(1);
    expect(collected[0]?.routes).toHaveLength(1);
  });

  it('drops a route that has both or neither of load and element', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const collected = collectFeatures({
      '../features/a/routes.tsx': {
        features: [module('a', { routes: [{ path: 'none' }, { path: 'ok', ...page }] })],
      },
    });

    expect(collected[0]?.routes.map((route) => route.path)).toEqual(['ok']);
  });

  it('drops a duplicate route path and a duplicate nav id', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const collected = collectFeatures({
      '../features/a/routes.tsx': { features: [module('a')] },
      '../features/b/routes.tsx': {
        features: [module('b', { routes: [{ path: 'a', ...page }], nav: module('a').nav })],
      },
    });

    expect(collected[1]?.routes).toEqual([]);
    expect(collected[1]?.nav).toEqual([]);
  });
});

describe('navItemsFor', () => {
  it('orders the items of all modules by order, then id, with absolute paths', () => {
    const items = navItemsFor([
      module('b', { nav: [{ id: 'b', label: 'b', path: 'b', order: 2, icon: 'list' }] }),
      module('c', { nav: [{ id: 'c', label: 'c', path: 'c/x', order: 1, icon: 'list' }] }),
      module('a', { nav: [{ id: 'a', label: 'a', path: 'a', order: 1, icon: 'list' }] }),
    ]);

    expect(items.map((item) => [item.id, item.to])).toEqual([
      ['a', '/a'],
      ['c', '/c/x'],
      ['b', '/b'],
    ]);
  });
});

describe('appPath', () => {
  it.each([
    ['claims', '/claims'],
    ['/claims', '/claims'],
    ['claims/12', '/claims/12'],
  ])('turns %s into %s', (relative, expected) => {
    expect(appPath(relative)).toBe(expected);
  });
});

describe('the registered features', () => {
  it('register without problems and every nav label has a translation', async () => {
    const { hasTranslation } = await import('../lib/i18n');

    for (const item of navItemsFor(features)) {
      expect(hasTranslation(item.label), item.label).toBe(true);
    }
  });
});
