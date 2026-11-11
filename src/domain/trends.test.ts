import { describe, expect, it } from 'vitest';
import { createFood } from './food';
import { createFoodLogEntry } from './log';
import { EARLIEST_DATE } from './targets';
import { dailySeries, isOnTarget, summarizePeriod } from './trends';

const food = createFood(
  {
    name: 'Rice',
    servingLabel: '1 cup',
    macros: { calories: 200, protein: 4, carbs: 44, fat: 0.4 },
    favorite: false,
  },
  { id: 'rice', now: 1 },
);
const entry = (id: string, date: string, servings: number) =>
  createFoodLogEntry({ id, food, servings, date, timestamp: 1 });

const history = [
  { effectiveFrom: EARLIEST_DATE, targets: { calories: 2000, protein: 150 } },
  { effectiveFrom: '2026-11-08', targets: { calories: 1800, protein: 160, carbs: 180 } },
];

describe('dailySeries', () => {
  it('returns every day in range with totals and the target in effect that day', () => {
    const days = dailySeries(
      [entry('a', '2026-11-06', 10), entry('b', '2026-11-08', 4), entry('c', '2026-11-08', 5)],
      history,
      '2026-11-06',
      '2026-11-09',
    );
    expect(days.map((d) => [d.date, d.entryCount, d.totals.calories, d.targets.calories])).toEqual([
      ['2026-11-06', 1, 2000, 2000],
      ['2026-11-07', 0, 0, 2000],
      ['2026-11-08', 2, 1800, 1800],
      ['2026-11-09', 0, 0, 1800],
    ]);
  });

  it('crosses month boundaries', () => {
    expect(dailySeries([], history, '2026-10-30', '2026-11-02').map((d) => d.date)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });
});

describe('summarizePeriod', () => {
  it('averages logged days, excluding empty days and today', () => {
    const days = dailySeries(
      [
        entry('a', '2026-11-07', 10), // 2000 vs 2000: on target
        entry('b', '2026-11-08', 7), // 1400 vs 1800: 22% under
        entry('c', '2026-11-10', 1), // today: excluded
      ],
      history,
      '2026-11-04',
      '2026-11-10',
    );
    const s = summarizePeriod(days, '2026-11-10');
    expect(s.daysCounted).toBe(2);
    expect(s.average.calories).toBe(1700);
    expect(s.averageTargets.calories).toBe(1900);
    expect(s.averageTargets.protein).toBe(155);
    // Only one counted day had a carbs target, so there's no like-for-like average.
    expect(s.averageTargets.carbs).toBeUndefined();
    expect(s.averageTargets.fat).toBeUndefined();
    expect(s.daysOnTarget).toBe(1);
  });

  it('handles a period with nothing logged', () => {
    const s = summarizePeriod(dailySeries([], history, '2026-11-01', '2026-11-07'), '2026-11-10');
    expect(s).toEqual({
      daysCounted: 0,
      average: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      averageTargets: {},
      daysOnTarget: 0,
    });
  });
});

describe('isOnTarget', () => {
  it('uses a ±10% band around the calorie target', () => {
    const day = (calories: number) => ({
      date: '2026-11-10',
      entryCount: 1,
      totals: { calories, protein: 0, carbs: 0, fat: 0 },
      targets: { calories: 2000, protein: 0 },
    });
    expect(isOnTarget(day(1800))).toBe(true);
    expect(isOnTarget(day(2200))).toBe(true);
    expect(isOnTarget(day(2201))).toBe(false);
  });
});
