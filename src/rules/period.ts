/** The reporting window of the period figures. Both ends are calendar dates in Africa/Gaborone and inclusive. */
import { DEFAULT_PERIOD, dateOf } from '../contracts/index.js';
import type { PeriodOption } from '../contracts/index.js';

export interface PeriodWindow {
  readonly option: PeriodOption;
  readonly from: string;
  readonly to: string;
}

const DAY_MS = 86_400_000;
const LAST_DAYS: Readonly<Record<Exclude<PeriodOption, 'mtd'>, number>> = { '7d': 7, '30d': 30, '90d': 90 };

/** The last N days include the as-of date itself, so `7d` ending 21 Oct starts on 15 Oct; month to date starts on the 1st. */
export function periodWindow(option: PeriodOption | undefined, asOf: string): PeriodWindow {
  const chosen = option ?? DEFAULT_PERIOD;
  if (chosen === 'mtd') {
    return { option: chosen, from: `${asOf.slice(0, 8)}01`, to: asOf };
  }
  const [year = 0, month = 1, day = 1] = asOf.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - (LAST_DAYS[chosen] - 1) * DAY_MS);
  return { option: chosen, from: start.toISOString().slice(0, 10), to: asOf };
}

/** A date or time falls in the window by its Africa/Gaborone date; an unknown moment is in no window. */
export function inPeriod(moment: string | null, window: PeriodWindow): boolean {
  if (moment === null) return false;
  const date = dateOf(moment);
  return date >= window.from && date <= window.to;
}
