import { describe, expect, it } from 'vitest';
import {
  computeProgress,
  DEFAULT_TARGETS,
  EARLIEST_DATE,
  isTargetHistory,
  targetsForDate,
  validateTargets,
  withTargets,
} from './targets';

describe('targets', () => {
  it('computes consumed, remaining and fraction', () => {
    const p = computeProgress(
      { calories: 1500, protein: 160, carbs: 100, fat: 50 },
      { calories: 2000, protein: 150, carbs: 200 },
    );
    expect(p.calories).toEqual({
      key: 'calories',
      consumed: 1500,
      target: 2000,
      remaining: 500,
      fraction: 0.75,
    });
    expect(p.protein.remaining).toBe(-10);
    expect(p.carbs.fraction).toBe(0.5);
    expect(p.fat).toEqual({ key: 'fat', consumed: 50 });
  });

  it('validates targets', () => {
    expect(validateTargets({ calories: 1800, protein: 140 })).toEqual({ ok: true });
    const bad = validateTargets({ calories: 0, protein: NaN, fat: -1 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['calories', 'fat', 'protein']);
  });
});

describe('target history', () => {
  const a = { calories: 2000, protein: 150 };
  const b = { calories: 1800, protein: 160 };
  const c = { calories: 2200, protein: 170 };

  it('finds the targets in effect on a date', () => {
    const history = [
      { effectiveFrom: EARLIEST_DATE, targets: a },
      { effectiveFrom: '2026-11-08', targets: b },
    ];
    expect(targetsForDate(history, '2020-01-01')).toBe(a);
    expect(targetsForDate(history, '2026-11-07')).toBe(a);
    expect(targetsForDate(history, '2026-11-08')).toBe(b);
    expect(targetsForDate(history, '2030-01-01')).toBe(b);
  });

  it('uses the first period for days before it, and defaults when empty', () => {
    expect(targetsForDate([{ effectiveFrom: '2026-11-08', targets: b }], '2026-01-01')).toBe(b);
    expect(targetsForDate([], '2026-01-01')).toEqual(DEFAULT_TARGETS);
  });

  it('keeps earlier periods and replaces same-day or later ones', () => {
    let h = withTargets([{ effectiveFrom: EARLIEST_DATE, targets: a }], b, '2026-11-08');
    expect(h.map((p) => p.effectiveFrom)).toEqual([EARLIEST_DATE, '2026-11-08']);
    h = withTargets(h, c, '2026-11-08');
    expect(h).toEqual([
      { effectiveFrom: EARLIEST_DATE, targets: a },
      { effectiveFrom: '2026-11-08', targets: c },
    ]);
    h = withTargets(h, b, '2026-11-01');
    expect(h.map((p) => p.targets)).toEqual([a, b]);
  });

  it('checks stored shapes', () => {
    expect(isTargetHistory([{ effectiveFrom: EARLIEST_DATE, targets: a }])).toBe(true);
    expect(isTargetHistory([{ effectiveFrom: EARLIEST_DATE, targets: { calories: '1' } }])).toBe(
      false,
    );
    expect(isTargetHistory({})).toBe(false);
  });
});
