import type { Macros } from './types';

export const ZERO_MACROS: Readonly<Macros> = Object.freeze({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
});

export const MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat'] as const;

/** kcal per gram (Atwater general factors). */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/** Relative difference above which entered calories look inconsistent with macros. */
export const CALORIE_MISMATCH_THRESHOLD = 0.15;

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    calories: m.calories * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
  };
}

export function sumMacros(list: readonly Macros[]): Macros {
  return list.reduce<Macros>((acc, m) => addMacros(acc, m), { ...ZERO_MACROS });
}

/** Calories implied by macros: 4 * protein + 4 * carbs + 9 * fat. */
export function atwaterCalories(m: Pick<Macros, 'protein' | 'carbs' | 'fat'>): number {
  return (
    KCAL_PER_GRAM.protein * m.protein + KCAL_PER_GRAM.carbs * m.carbs + KCAL_PER_GRAM.fat * m.fat
  );
}

export interface CalorieShares {
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Each macro's share of the 4/4/9 energy (fractions summing to 1), or null when there are no
 * macros. Used to split a calorie total by source.
 */
export function macroCalorieShares(
  m: Pick<Macros, 'protein' | 'carbs' | 'fat'>,
): CalorieShares | null {
  const total = atwaterCalories(m);
  if (!(total > 0)) return null;
  return {
    protein: (KCAL_PER_GRAM.protein * m.protein) / total,
    carbs: (KCAL_PER_GRAM.carbs * m.carbs) / total,
    fat: (KCAL_PER_GRAM.fat * m.fat) / total,
  };
}

export interface CalorieCheck {
  entered: number;
  expected: number;
  /** |entered - expected| / max(entered, expected); 0 when both are 0. */
  difference: number;
  mismatch: boolean;
}

/** Soft sanity check: does the entered calorie value agree with the macros? */
export function checkCalories(m: Macros, threshold = CALORIE_MISMATCH_THRESHOLD): CalorieCheck {
  const expected = atwaterCalories(m);
  const larger = Math.max(m.calories, expected);
  const difference = larger === 0 ? 0 : Math.abs(m.calories - expected) / larger;
  return { entered: m.calories, expected, difference, mismatch: difference > threshold };
}

// Display-only rounding. Stored values are never rounded.
export function roundCalories(value: number): number {
  return Math.round(value) || 0;
}

export function roundGrams(value: number): number {
  return Math.round(value * 10) / 10 || 0;
}
