import { describe, expect, it } from 'vitest';

import {
  ENTITIES,
  ENTITY_NAMES,
  ISSUE_FIX,
  Money,
  Moment,
  addMoney,
  compareMoney,
  endpoints,
  instantOf,
  normalizeMoney,
  onOrBeforeAsOf,
  sumMoney,
} from './index.js';

describe('the contracts', () => {
  it('cover the 17 entities keyed (tenant_id, id) with parents before children, give every endpoint a unique id, and keep money decimal-safe', () => {
    expect(ENTITY_NAMES).toHaveLength(17);
    expect(new Set(Object.values(ENTITIES).map((entity) => entity.file)).size).toBe(17);
    ENTITY_NAMES.forEach((name, index) => {
      const entity = ENTITIES[name];
      expect(Object.keys(entity.schema.shape)).toEqual(expect.arrayContaining(['tenant_id', entity.idField]));
      for (const reference of entity.references) {
        expect(Object.keys(entity.schema.shape)).toContain(reference.field);
        expect(ENTITY_NAMES.indexOf(reference.entity), `${name}.${reference.field}`).toBeLessThan(index);
      }
    });

    const all = Object.values(endpoints);
    expect(new Set(all.map((endpoint) => endpoint.id)).size).toBe(all.length);
    expect(all.every((endpoint) => endpoint.path.startsWith('/api/v1/'))).toBe(true);

    expect(addMoney('0.10', '0.20')).toBe('0.30');
    expect(sumMoney(['0.10', '0.20', '1000000.05'])).toBe('1000000.35');
    expect(compareMoney('10.00', '9.99')).toBeGreaterThan(0);
    expect([normalizeMoney('14000'), normalizeMoney('7.5'), normalizeMoney('-5'), normalizeMoney('1,500')]).toEqual(['14000.00', '7.50', '-5', '1,500']);

    const rejected = Money.safeParse('-5');
    expect(rejected.success).toBe(false);
    expect(JSON.stringify(rejected.error?.issues)).toContain(ISSUE_FIX);
    expect(Moment.safeParse('2026-10-21').success).toBe(true);
    expect(Moment.safeParse('2026-10-21T08:00:00+02:00').success).toBe(true);
    expect([Moment.safeParse('2026-02-30').success, Moment.safeParse('2026-10-21T08:00:00Z').success]).toEqual([false, false]);

    expect(instantOf(new Date('2026-11-06T22:30:00Z'))).toBe('2026-11-07T00:30:00+02:00');
    expect([onOrBeforeAsOf('2026-10-21T23:00:00+02:00', '2026-10-21'), onOrBeforeAsOf('2026-10-22', '2026-10-21')]).toEqual([true, false]);
  });
});
