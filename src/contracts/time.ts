/** Every instant is Africa/Gaborone, which has no daylight saving: always +02:00. */

export const DEFAULT_AS_OF = '2026-10-21';
export const GABORONE_OFFSET = '+02:00';
export const GABORONE_ZONE = 'Africa/Gaborone';

const GABORONE_OFFSET_MS = 2 * 60 * 60 * 1000;

export function instantOf(date: Date): string {
  const wall = new Date(date.getTime() + GABORONE_OFFSET_MS).toISOString();
  return `${wall.slice(0, 19)}${GABORONE_OFFSET}`;
}

export function dateOf(moment: string): string {
  return moment.slice(0, 10);
}

export function onOrBeforeAsOf(moment: string, asOf: string): boolean {
  return dateOf(moment) <= asOf;
}

export function isRealDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match === null) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
  );
}
