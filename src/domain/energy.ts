import { KCAL_PER_GRAM } from './macros';
import type { Targets } from './types';
import { feetInchesToCm, lbToKg } from './units';

/**
 * Estimated daily targets from body measurements.
 *
 * - BMR: Mifflin-St Jeor (Mifflin et al., Am J Clin Nutr 1990;51:241). Rated the most reliable
 *   common equation by the ADA systematic review (Frankenfield et al., J Am Diet Assoc
 *   2005;105:775): usually within 10% of measured resting energy expenditure.
 * - TDEE: BMR × physical activity factor.
 * - Protein: 1.6 g/kg (Morton et al., Br J Sports Med 2018;52:376: no further fat-free mass
 *   gain above ~1.62 g/kg/day), 2.0 g/kg in a deficit to help preserve lean mass.
 * - Fat: 30% of energy (IOM acceptable range 20–35%), at least 0.6 g/kg.
 * - Carbs: the remaining energy.
 */

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';
export type Goal = 'lose1' | 'lose05' | 'maintain' | 'gain05';

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
}

export const ACTIVITY_LEVELS: Readonly<
  Record<ActivityLevel, { factor: number; label: string; description: string }>
> = {
  sedentary: { factor: 1.2, label: 'Sedentary', description: 'Desk job, little exercise' },
  light: { factor: 1.375, label: 'Lightly active', description: 'Exercise 1–3 days/week' },
  moderate: { factor: 1.55, label: 'Moderately active', description: 'Exercise 3–5 days/week' },
  very: { factor: 1.725, label: 'Very active', description: 'Hard exercise 6–7 days/week' },
  extra: {
    factor: 1.9,
    label: 'Extremely active',
    description: 'Physical job plus hard training',
  },
};

/** Daily adjustment from the ~3,500 kcal per pound rule of thumb. */
export const GOALS: Readonly<Record<Goal, { kcalPerDay: number; label: string }>> = {
  lose1: { kcalPerDay: -500, label: 'Lose 1 lb/week' },
  lose05: { kcalPerDay: -250, label: 'Lose ½ lb/week' },
  maintain: { kcalPerDay: 0, label: 'Maintain weight' },
  gain05: { kcalPerDay: 250, label: 'Gain ½ lb/week' },
};

/** Commonly cited minimum intakes without medical supervision. */
export const CALORIE_FLOOR: Readonly<Record<Sex, number>> = { male: 1500, female: 1200 };

export const PROTEIN_G_PER_KG = { default: 1.6, deficit: 2.0 } as const;
export const FAT_ENERGY_SHARE = 0.3;
export const MIN_FAT_G_PER_KG = 0.6;
/** Above this BMI, protein and fat minimums use the weight at REFERENCE_BMI instead. */
export const HIGH_BMI = 30;
export const REFERENCE_BMI = 25;

export const PROFILE_LIMITS = {
  age: { min: 18, max: 100 },
  heightCm: { min: feetInchesToCm(4, 0), max: feetInchesToCm(7, 6) },
  weightKg: { min: lbToKg(66), max: lbToKg(660) },
} as const;

export function bmrMifflinStJeor(
  p: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'weightKg'>,
): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'male' ? base + 5 : base - 161;
}

export function bmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export interface TargetEstimate {
  bmr: number;
  tdee: number;
  goalAdjustment: number;
  /** tdee + goalAdjustment, before the floor and rounding. */
  goalCalories: number;
  floorApplied: boolean;
  bmi: number;
  /** Weight used for protein and the fat minimum (lower than actual when BMI ≥ HIGH_BMI). */
  referenceWeightKg: number;
  proteinPerKg: number;
  /** Whether fat came from the share of calories or the per-kg minimum. */
  fatBasis: 'share' | 'minimum';
  /** Rounded: kcal to the nearest 10, grams to the nearest 5. */
  targets: Required<Targets>;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

export function estimateTargets(p: Profile): TargetEstimate {
  const bmr = bmrMifflinStJeor(p);
  const tdee = bmr * ACTIVITY_LEVELS[p.activity].factor;
  const goalAdjustment = GOALS[p.goal].kcalPerDay;
  const goalCalories = tdee + goalAdjustment;
  const floor = CALORIE_FLOOR[p.sex];
  const floorApplied = goalCalories < floor;
  const calories = roundTo(Math.max(goalCalories, floor), 10);

  const bodyMassIndex = bmi(p.heightCm, p.weightKg);
  const heightM = p.heightCm / 100;
  const referenceWeightKg =
    bodyMassIndex >= HIGH_BMI ? REFERENCE_BMI * heightM * heightM : p.weightKg;

  const proteinPerKg = goalAdjustment < 0 ? PROTEIN_G_PER_KG.deficit : PROTEIN_G_PER_KG.default;
  const protein = roundTo(proteinPerKg * referenceWeightKg, 5);
  const fatFromShare = (FAT_ENERGY_SHARE * calories) / KCAL_PER_GRAM.fat;
  const fatMinimum = MIN_FAT_G_PER_KG * referenceWeightKg;
  const fat = roundTo(Math.max(fatFromShare, fatMinimum), 5);
  const carbs = Math.max(
    0,
    roundTo(
      (calories - protein * KCAL_PER_GRAM.protein - fat * KCAL_PER_GRAM.fat) / KCAL_PER_GRAM.carbs,
      5,
    ),
  );

  return {
    bmr,
    tdee,
    goalAdjustment,
    goalCalories,
    floorApplied,
    bmi: bodyMassIndex,
    referenceWeightKg,
    proteinPerKg,
    fatBasis: fatMinimum > fatFromShare ? 'minimum' : 'share',
    targets: { calories, protein, carbs, fat },
  };
}

export type ProfileValidation =
  { ok: true } | { ok: false; errors: Partial<Record<'age' | 'heightCm' | 'weightKg', string>> };

export function validateProfile(
  p: Pick<Profile, 'age' | 'heightCm' | 'weightKg'>,
): ProfileValidation {
  const errors: Partial<Record<'age' | 'heightCm' | 'weightKg', string>> = {};
  const { age, heightCm, weightKg } = PROFILE_LIMITS;
  if (!(Number.isFinite(p.age) && p.age >= age.min && p.age <= age.max))
    errors.age = `Enter an age from ${age.min} to ${age.max}`;
  if (!(Number.isFinite(p.heightCm) && p.heightCm >= heightCm.min && p.heightCm <= heightCm.max))
    errors.heightCm = 'Enter a height from 4′0″ to 7′6″';
  if (!(Number.isFinite(p.weightKg) && p.weightKg >= weightKg.min && p.weightKg <= weightKg.max))
    errors.weightKg = 'Enter a weight from 66 to 660 lb';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

export function isProfile(v: unknown): v is Profile {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    (p.sex === 'male' || p.sex === 'female') &&
    typeof p.age === 'number' &&
    typeof p.heightCm === 'number' &&
    typeof p.weightKg === 'number' &&
    typeof p.activity === 'string' &&
    p.activity in ACTIVITY_LEVELS &&
    typeof p.goal === 'string' &&
    p.goal in GOALS
  );
}
