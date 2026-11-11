import type { LocalDate, MacroKey, Macros, Targets } from './types';

export const DEFAULT_TARGETS: Readonly<Targets> = Object.freeze({
  calories: 2000,
  protein: 150,
});

/** Targets in effect from `effectiveFrom` until the next period starts. */
export interface TargetPeriod {
  effectiveFrom: LocalDate;
  targets: Targets;
}

/** Sorted by `effectiveFrom`, ascending. */
export type TargetHistory = TargetPeriod[];

/** Sorts before any real date, so a period starting here covers all past days. */
export const EARLIEST_DATE: LocalDate = '0000-01-01';

/** Targets in effect on `date`. Days before the first period use the first period's targets. */
export function targetsForDate(history: readonly TargetPeriod[], date: LocalDate): Targets {
  if (history.length === 0) return { ...DEFAULT_TARGETS };
  let current = history[0]!.targets;
  for (const period of history) {
    if (period.effectiveFrom <= date) current = period.targets;
    else break;
  }
  return current;
}

/**
 * Records `targets` from `effectiveFrom` onward. Earlier periods are kept so past days keep the
 * targets they had; periods on or after `effectiveFrom` are replaced.
 */
export function withTargets(
  history: readonly TargetPeriod[],
  targets: Targets,
  effectiveFrom: LocalDate,
): TargetHistory {
  const earlier = history
    .filter((p) => p.effectiveFrom < effectiveFrom)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return [...earlier, { effectiveFrom, targets }];
}

export function isTargets(v: unknown): v is Targets {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  const optionalNumber = (x: unknown) => x === undefined || typeof x === 'number';
  return (
    typeof t.calories === 'number' &&
    typeof t.protein === 'number' &&
    optionalNumber(t.carbs) &&
    optionalNumber(t.fat)
  );
}

export function isTargetHistory(v: unknown): v is TargetHistory {
  return (
    Array.isArray(v) &&
    v.every(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as TargetPeriod).effectiveFrom === 'string' &&
        isTargets((p as TargetPeriod).targets),
    )
  );
}

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
