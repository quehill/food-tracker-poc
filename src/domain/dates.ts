import type { LocalDate } from './types';

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** The user's local calendar date for an instant. */
export function toLocalDate(d: Date): LocalDate {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isValidLocalDate(s: string): s is LocalDate {
  const m = LOCAL_DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** Local midnight at the start of `s`. */
export function parseLocalDate(s: LocalDate): Date {
  const m = LOCAL_DATE_RE.exec(s);
  if (!m || !isValidLocalDate(s)) throw new RangeError(`Invalid local date: ${s}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Calendar arithmetic (not 24h arithmetic), so DST days of 23/25 hours are handled. */
export function addDays(s: LocalDate, days: number): LocalDate {
  const d = parseLocalDate(s);
  return toLocalDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/**
 * Timestamp for an entry logged onto `date`: `now` if `date` is today, otherwise
 * the same wall-clock time on that calendar date.
 */
export function timestampForDate(date: LocalDate, now: Date): number {
  if (toLocalDate(now) === date) return now.getTime();
  const d = parseLocalDate(date);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ).getTime();
}
