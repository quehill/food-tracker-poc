import type { MacroKey, Macros, Targets } from './types';

export const DEFAULT_TARGETS: Readonly<Targets> = Object.freeze({
  calories: 2000,
  protein: 150,
});

export interface MacroProgress {
  key: MacroKey;
  consumed: number;
  target?: number;
  /** target - consumed; negative when over. */
  remaining?: number;
  /** consumed / target, unclamped. */
  fraction?: number;
}

export function computeProgress(totals: Macros, targets: Targets): Record<MacroKey, MacroProgress> {
  const one = (key: MacroKey): MacroProgress => {
    const consumed = totals[key];
    const target = targets[key];
    if (target === undefined || !(target > 0)) return { key, consumed };
    return { key, consumed, target, remaining: target - consumed, fraction: consumed / target };
  };
  return {
    calories: one('calories'),
    protein: one('protein'),
    carbs: one('carbs'),
    fat: one('fat'),
  };
}

export type TargetsValidation =
  { ok: true } | { ok: false; errors: Partial<Record<keyof Targets, string>> };

export function validateTargets(t: {
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
}): TargetsValidation {
  const errors: Partial<Record<keyof Targets, string>> = {};
  if (!(Number.isFinite(t.calories) && t.calories > 0)) errors.calories = 'Must be greater than 0';
  if (!(Number.isFinite(t.protein) && t.protein >= 0)) errors.protein = 'Must be 0 or more';
  for (const k of ['carbs', 'fat'] as const) {
    const v = t[k];
    if (v !== undefined && !(Number.isFinite(v) && v >= 0)) errors[k] = 'Must be 0 or more';
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}
