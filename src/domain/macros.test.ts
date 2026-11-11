import { describe, expect, it } from 'vitest';
import {
  addMacros,
  atwaterCalories,
  checkCalories,
  roundCalories,
  roundGrams,
  scaleMacros,
  sumMacros,
} from './macros';

const egg = { calories: 70, protein: 6, carbs: 0.5, fat: 5 };
const banana = { calories: 105, protein: 1.3, carbs: 27, fat: 0.4 };

describe('macro arithmetic', () => {
  it('adds, scales and sums', () => {
    expect(addMacros(egg, banana)).toEqual({ calories: 175, protein: 7.3, carbs: 27.5, fat: 5.4 });
    expect(scaleMacros(egg, 2)).toEqual({ calories: 140, protein: 12, carbs: 1, fat: 10 });
    expect(sumMacros([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(sumMacros([egg, egg, egg]).calories).toBe(210);
  });

  it('does not mutate inputs', () => {
    const copy = { ...egg };
    scaleMacros(egg, 3);
    addMacros(egg, banana);
    expect(egg).toEqual(copy);
  });
});

describe('calorie sanity check', () => {
  it('computes Atwater calories', () => {
    expect(atwaterCalories({ protein: 10, carbs: 10, fat: 10 })).toBe(170);
  });

  it('accepts values within 15%', () => {
    // Premier Protein: 4*30 + 4*5 + 9*3 = 167 vs 160 entered
    expect(checkCalories({ calories: 160, protein: 30, carbs: 5, fat: 3 }).mismatch).toBe(false);
  });

  it('flags values beyond 15%', () => {
    const r = checkCalories({ calories: 300, protein: 30, carbs: 5, fat: 3 });
    expect(r.expected).toBe(167);
    expect(r.mismatch).toBe(true);
  });

  it('flags calories with no macros, and macros with zero calories', () => {
    expect(checkCalories({ calories: 100, protein: 0, carbs: 0, fat: 0 }).mismatch).toBe(true);
    expect(checkCalories({ calories: 0, protein: 10, carbs: 0, fat: 0 }).mismatch).toBe(true);
  });

  it('treats all-zero as consistent', () => {
    expect(checkCalories({ calories: 0, protein: 0, carbs: 0, fat: 0 })).toMatchObject({
      difference: 0,
      mismatch: false,
    });
  });
});

describe('display rounding', () => {
  it('rounds calories to whole numbers', () => {
    expect(roundCalories(104.5)).toBe(105);
    expect(roundCalories(104.49)).toBe(104);
  });

  it('rounds grams to 0.1', () => {
    expect(roundGrams(1.25)).toBe(1.3);
    expect(roundGrams(0.04)).toBe(0);
    expect(roundGrams(26.666)).toBe(26.7);
  });

  it('never returns negative zero', () => {
    expect(Object.is(roundGrams(-0.01), 0)).toBe(true);
    expect(Object.is(roundCalories(-0.2), 0)).toBe(true);
  });
});
