import { describe, expect, it } from 'vitest';

import {
  EMPTY_VALUE,
  formatAge,
  formatBytes,
  formatCalendarDate,
  formatCount,
  formatDateTime,
  formatInstantDate,
  formatOfficialTime,
  formatTimeRemaining,
  initialsOf,
  normalizeOffset,
  officialTimeParts,
} from './format';

describe('number helpers', () => {
  it('formats counts with grouping and an empty count as the dash', () => {
    expect(formatCount(12500)).toBe('12,500');
    expect(formatCount(null)).toBe(EMPTY_VALUE);
  });
});

describe('official time', () => {
  it('renders the deadline with date, time, UTC offset and IANA zone', () => {
    expect(formatOfficialTime('2026-10-14T10:00:00Z', 'Africa/Gaborone')).toBe(
      '14 Oct 2026, 12:00 (UTC+02:00) Africa/Gaborone',
    );
  });

  it('uses the official zone, not the browser zone, including half-hour offsets', () => {
    expect(formatOfficialTime('2026-10-14T10:00:00Z', 'Asia/Kolkata')).toBe(
      '14 Oct 2026, 15:30 (UTC+05:30) Asia/Kolkata',
    );
  });

  it('reports UTC as UTC+00:00 and a named zone with its numeric offset', () => {
    const utc = officialTimeParts('2026-01-01T00:00:00Z', 'UTC');
    expect(utc.offset).toBe('UTC+00:00');
    const newYork = officialTimeParts('2026-01-15T17:00:00Z', 'America/New_York');
    expect(newYork.text).toBe('15 Jan 2026, 12:00 (UTC-05:00) America/New_York');
  });

  it('normalizes the GMT forms Intl produces', () => {
    expect(normalizeOffset('GMT+2')).toBe('UTC+02:00');
    expect(normalizeOffset('GMT-05:30')).toBe('UTC-05:30');
    expect(normalizeOffset('GMT')).toBe('UTC+00:00');
  });

  it('formats secondary timestamps and dates in a zone', () => {
    expect(formatDateTime('2026-09-29T22:30:00Z', 'Africa/Gaborone')).toBe('30 Sep 2026, 00:30');
    expect(formatInstantDate('2026-09-29T22:30:00Z', 'Africa/Gaborone')).toBe('30 Sep 2026');
    expect(formatDateTime(null, 'UTC')).toBe(EMPTY_VALUE);
  });

  it('formats calendar dates without a zone shift', () => {
    expect(formatCalendarDate('2026-10-01')).toBe('1 Oct 2026');
    expect(formatCalendarDate(null)).toBe(EMPTY_VALUE);
  });
});

describe('relative time', () => {
  const now = Date.parse('2026-09-29T12:00:00Z');

  it('shows ages as in the reference tables', () => {
    expect(formatAge('2026-08-22T12:00:00Z', now)).toBe('38d');
    expect(formatAge('2026-09-29T07:00:00Z', now)).toBe('5h');
    expect(formatAge('2026-09-29T11:48:00Z', now)).toBe('12m');
    expect(formatAge('2026-09-29T11:59:30Z', now)).toBe('now');
  });

  it('describes the time left or elapsed next to an official time', () => {
    expect(formatTimeRemaining('2026-10-01T16:00:00Z', now)).toBe('2 d 4 h left');
    expect(formatTimeRemaining('2026-09-29T15:05:00Z', now)).toBe('3 h 5 min left');
    expect(formatTimeRemaining('2026-09-27T12:00:00Z', now)).toBe('passed 2 d 0 h ago');
  });

  it('says now within a minute either way instead of 1 min left or passed 0 min ago', () => {
    expect(formatTimeRemaining('2026-09-29T12:00:30Z', now)).toBe('now');
    expect(formatTimeRemaining('2026-09-29T11:59:31Z', now)).toBe('now');
    expect(formatTimeRemaining('2026-09-29T12:01:00Z', now)).toBe('1 min left');
  });
});

describe('misc', () => {
  it('formats byte sizes and initials', () => {
    expect(formatBytes(12)).toBe('12 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(52_428_800)).toBe('50 MB');
  });

  it('chooses the byte unit after rounding, so a size near a boundary never reads 1024 KB', () => {
    expect(formatBytes(1_048_575)).toBe('1 MB');
    expect(formatBytes(1_023 * 1024)).toBe('1023 KB');
    expect(initialsOf('Kagiso Dube')).toBe('KD');
    expect(initialsOf('Sam')).toBe('S');
  });
});
