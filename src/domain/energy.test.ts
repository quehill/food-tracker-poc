import { describe, expect, it } from 'vitest';
import {
  bmrMifflinStJeor,
  CALORIE_FLOOR,
  estimateTargets,
  isProfile,
  validateProfile,
  type Profile,
} from './energy';
import { feetInchesToCm, lbToKg } from './units';

// Worked example from the plan: male, 35, 5′11″, 176 lb, moderately active.
const man: Profile = {
  sex: 'male',
  age: 35,
  heightCm: feetInchesToCm(5, 11),
  weightKg: lbToKg(176),
  activity: 'moderate',
  goal: 'maintain',
};

describe('bmrMifflinStJeor', () => {
  it('matches the published equations (Mifflin et al. 1990)', () => {
    const body = { age: 35, heightCm: 180, weightKg: 80 };
    // 10·80 + 6.25·180 − 5·35 = 1750
    expect(bmrMifflinStJeor({ ...body, sex: 'male' })).toBe(1755);
    expect(bmrMifflinStJeor({ ...body, sex: 'female' })).toBe(1589);
  });
});

describe('estimateTargets', () => {
  it('estimates maintenance targets for the worked example', () => {
    const e = estimateTargets(man);
    expect(e.bmr).toBeCloseTo(1755.4, 1);
    expect(e.tdee).toBeCloseTo(2720.9, 1);
    expect(e.goalAdjustment).toBe(0);
    expect(e.floorApplied).toBe(false);
    expect(e.proteinPerKg).toBe(1.6);
    // P 1.6 × 79.8 kg ≈ 128 → 130; F 30% of 2720 / 9 ≈ 91 → 90; C (2720 − 520 − 810) / 4 ≈ 348 → 350
    expect(e.targets).toEqual({ calories: 2720, protein: 130, carbs: 350, fat: 90 });
  });

  it('subtracts 500 kcal and raises protein to 2.0 g/kg when losing 1 lb/week', () => {
    const e = estimateTargets({ ...man, goal: 'lose1' });
    expect(e.goalAdjustment).toBe(-500);
    expect(e.proteinPerKg).toBe(2);
    expect(e.targets).toEqual({ calories: 2220, protein: 160, carbs: 225, fat: 75 });
  });

  it('adds 250 kcal for a lean gain and keeps 1.6 g/kg protein', () => {
    const e = estimateTargets({ ...man, goal: 'gain05' });
    expect(e.targets.calories).toBe(2970);
    expect(e.proteinPerKg).toBe(1.6);
  });

  it('applies the activity factor', () => {
    const woman: Profile = {
      sex: 'female',
      age: 30,
      heightCm: feetInchesToCm(5, 5),
      weightKg: lbToKg(140),
      activity: 'light',
      goal: 'maintain',
    };
    const e = estimateTargets(woman);
    expect(e.bmr).toBeCloseTo(1355.9, 1);
    expect(e.tdee).toBeCloseTo(e.bmr * 1.375, 6);
    expect(e.targets.calories).toBe(1860);
  });

  it('never goes below the calorie floor', () => {
    const e = estimateTargets({
      sex: 'female',
      age: 60,
      heightCm: feetInchesToCm(4, 11),
      weightKg: lbToKg(100),
      activity: 'sedentary',
      goal: 'lose1',
    });
    expect(e.goalCalories).toBeLessThan(CALORIE_FLOOR.female);
    expect(e.floorApplied).toBe(true);
    expect(e.targets.calories).toBe(CALORIE_FLOOR.female);
    // 30% of 1200 kcal ≈ 40 g fat, above the 0.6 g/kg minimum (≈27 g).
    expect(e.fatBasis).toBe('share');
  });

  it('uses the fat minimum when 30% of calories would be lower', () => {
    const e = estimateTargets({
      sex: 'male',
      age: 80,
      heightCm: feetInchesToCm(5, 9),
      weightKg: lbToKg(200),
      activity: 'sedentary',
      goal: 'lose1',
    });
    // Floor of 1500 kcal: 30% / 9 ≈ 50 g < 0.6 × 90.7 kg ≈ 54 g
    expect(e.bmi).toBeLessThan(30);
    expect(e.floorApplied).toBe(true);
    expect(e.fatBasis).toBe('minimum');
    expect(e.targets.fat).toBe(55);
  });

  it('uses the weight at BMI 25 for protein when BMI is 30 or more', () => {
    const e = estimateTargets({
      ...man,
      age: 40,
      heightCm: feetInchesToCm(5, 10),
      weightKg: lbToKg(300),
    });
    expect(e.bmi).toBeGreaterThan(30);
    expect(e.referenceWeightKg).toBeCloseTo(25 * 1.778 ** 2, 1);
    expect(e.targets.protein).toBe(125);
  });

  it('keeps macro energy close to the calorie target', () => {
    for (const goal of ['lose1', 'lose05', 'maintain', 'gain05'] as const) {
      const { calories, protein, carbs, fat } = estimateTargets({ ...man, goal }).targets;
      expect(Math.abs(4 * protein + 4 * carbs + 9 * fat - calories)).toBeLessThanOrEqual(25);
    }
  });
});

describe('validateProfile', () => {
  it('accepts adult ranges and rejects out-of-range values', () => {
    expect(validateProfile(man)).toEqual({ ok: true });
    const bad = validateProfile({ age: 12, heightCm: 50, weightKg: NaN });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['age', 'heightCm', 'weightKg']);
  });

  it('accepts the exact imperial limits', () => {
    expect(
      validateProfile({ age: 18, heightCm: feetInchesToCm(4, 0), weightKg: lbToKg(66) }),
    ).toEqual({ ok: true });
  });
});

describe('isProfile', () => {
  it('checks the stored shape', () => {
    expect(isProfile(man)).toBe(true);
    expect(isProfile({ ...man, activity: 'couch' })).toBe(false);
    expect(isProfile(null)).toBe(false);
  });
});
