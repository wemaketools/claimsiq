/** Date arithmetic for the rules: calendar days and business days between two dates, in Africa/Gaborone wall time. */
import { dateOf } from '../contracts/index.js';
import { BUSINESS_DAY_CODES } from './config.js';

const DAY_MS = 86_400_000;
const GABORONE_MIDNIGHT = 'T00:00:00+02:00';

function dayNumber(moment: string): number {
  const [year = 0, month = 1, day = 1] = dateOf(moment).split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** Position in time, for ordering events; a date alone means the start of that day. */
export function momentMs(moment: string): number {
  return Date.parse(moment.length === 10 ? `${moment}${GABORONE_MIDNIGHT}` : moment);
}

/** Calendar days from `from` to `to`; negative when `to` is earlier. */
export function calendarDaysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

export function weekdaySet(codes: readonly (typeof BUSINESS_DAY_CODES)[number][]): ReadonlySet<number> {
  return new Set(codes.map((code) => BUSINESS_DAY_CODES.indexOf(code)));
}

/**
 * Business days completed after `from` up to and including `to`: a claim that entered a stage on a Friday has spent
 * one business day in it by Monday evening. Zero when `to` is not after `from`.
 */
export function businessDaysBetween(from: string, to: string, weekdays: ReadonlySet<number>): number {
  const start = dayNumber(from);
  const span = dayNumber(to) - start;
  let count = 0;
  for (let offset = 1; offset <= span; offset += 1) {
    // 1970-01-01 (day 0) was a Thursday; the codes count from Sunday.
    if (weekdays.has((start + offset + 4) % 7)) {
      count += 1;
    }
  }
  return count;
}
