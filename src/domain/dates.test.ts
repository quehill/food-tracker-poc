import { describe, expect, it } from 'vitest';
import { addDays, isValidLocalDate, parseLocalDate, timestampForDate, toLocalDate } from './dates';

// Vitest runs with TZ=America/New_York (see vite.config.ts).
// 2026 US DST: starts Sun 2026-03-08 02:00, ends Sun 2026-11-01 02:00.

describe('local date handling', () => {
  it('runs in a DST-observing zone', () => {
    const jan = new Date(2026, 0, 15).getTimezoneOffset();
    const jul = new Date(2026, 6, 15).getTimezoneOffset();
    expect(jan).not.toBe(jul);
  });

  it('formats the local calendar date, not the UTC date', () => {
    // 23:30 local on Jan 1 is already Jan 2 in UTC.
    const lateNight = new Date(2026, 0, 1, 23, 30);
    expect(lateNight.toISOString().slice(0, 10)).toBe('2026-01-02');
    expect(toLocalDate(lateNight)).toBe('2026-01-01');
  });

  it('handles the midnight boundary', () => {
    expect(toLocalDate(new Date(2026, 0, 1, 0, 0, 0, 0))).toBe('2026-01-01');
    expect(toLocalDate(new Date(2025, 11, 31, 23, 59, 59, 999))).toBe('2025-12-31');
  });

  it('adds calendar days across month/year ends and leap days', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('adds days across DST transitions (23h and 25h days)', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(addDays('2026-11-02', -2)).toBe('2026-10-31');
  });

  it('keeps the right date at the end of DST-change days', () => {
    expect(toLocalDate(new Date(2026, 2, 8, 23, 59))).toBe('2026-03-08');
    expect(toLocalDate(new Date(2026, 10, 1, 23, 59))).toBe('2026-11-01');
    // The 25-hour day: 24h after local midnight is still Nov 1.
    const start = parseLocalDate('2026-11-01').getTime();
    expect(toLocalDate(new Date(start + 24 * 3600 * 1000))).toBe('2026-11-01');
  });

  it('validates date strings', () => {
    expect(isValidLocalDate('2026-11-10')).toBe(true);
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2026-1-5')).toBe(false);
    expect(() => parseLocalDate('nope')).toThrow(RangeError);
  });

  it('timestampForDate uses now for today and same wall time for other days', () => {
    const now = new Date(2026, 10, 10, 13, 45, 12);
    expect(timestampForDate('2026-11-10', now)).toBe(now.getTime());
    const past = new Date(timestampForDate('2026-11-01', now));
    expect(toLocalDate(past)).toBe('2026-11-01');
    expect([past.getHours(), past.getMinutes()]).toEqual([13, 45]);
  });
});
