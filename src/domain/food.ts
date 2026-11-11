import { MACRO_KEYS } from './macros';
import type { Food, FoodSource, Macros } from './types';

/** User-editable fields of a food, as parsed numbers (NaN for unparseable input). */
export interface FoodDraft {
  name: string;
  brand?: string;
  servingLabel: string;
  servingGrams?: number;
  macros: Macros;
  favorite: boolean;
}

export type FoodDraftField = 'name' | 'servingLabel' | 'servingGrams' | keyof Macros;

export type FoodValidation =
  { ok: true } | { ok: false; errors: Partial<Record<FoodDraftField, string>> };

export function validateFoodDraft(draft: FoodDraft): FoodValidation {
  const errors: Partial<Record<FoodDraftField, string>> = {};
  if (!draft.name.trim()) errors.name = 'Name is required';
  if (!draft.servingLabel.trim()) errors.servingLabel = 'Serving label is required';
  if (draft.servingGrams !== undefined && !(draft.servingGrams > 0 && isFinite(draft.servingGrams)))
    errors.servingGrams = 'Must be a number greater than 0';
  for (const key of MACRO_KEYS) {
    const v = draft.macros[key];
    if (!Number.isFinite(v) || v < 0) errors[key] = 'Must be a number, 0 or more';
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

function trimmedOrUndefined(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}

export function createFood(
  draft: FoodDraft,
  opts: { id: string; now: number; source?: FoodSource; sourceId?: string },
): Food {
  return {
    id: opts.id,
    name: draft.name.trim(),
    brand: trimmedOrUndefined(draft.brand),
    source: opts.source ?? 'custom',
    sourceId: opts.sourceId,
    serving: { label: draft.servingLabel.trim(), grams: draft.servingGrams },
    macrosPerServing: { ...draft.macros },
    favorite: draft.favorite,
    useCount: 0,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}

/** True when `calories` is just `food`'s calories rescaled to a new serving weight. */
function isRescaledCalories(food: Food, calories: number, servingGrams?: number): boolean {
  const oldGrams = food.serving.grams;
  if (!oldGrams || !servingGrams) return false;
  const expected = (food.macrosPerServing.calories * servingGrams) / oldGrams;
  return Math.abs(calories - expected) < 1e-9 * Math.max(1, expected);
}

export function updateFood(food: Food, draft: FoodDraft, now: number): Food {
  const caloriesChanged =
    draft.macros.calories !== food.macrosPerServing.calories &&
    !isRescaledCalories(food, draft.macros.calories, draft.servingGrams);
  return {
    ...food,
    name: draft.name.trim(),
    brand: trimmedOrUndefined(draft.brand),
    serving: { label: draft.servingLabel.trim(), grams: draft.servingGrams },
    macrosPerServing: { ...draft.macros },
    // A user-entered calorie value is no longer an estimate.
    caloriesEstimated: caloriesChanged ? undefined : food.caloriesEstimated,
    favorite: draft.favorite,
    updatedAt: now,
  };
}

export function draftFromFood(food: Food): FoodDraft {
  return {
    name: food.name,
    brand: food.brand,
    servingLabel: food.serving.label,
    servingGrams: food.serving.grams,
    macros: { ...food.macrosPerServing },
    favorite: food.favorite,
  };
}

export function markFoodUsed(food: Food, now: number): Food {
  return { ...food, lastUsedAt: now, useCount: food.useCount + 1 };
}
