import { describe, expect, it } from 'vitest';
import { computeProgress, validateTargets } from './targets';

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
