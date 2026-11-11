import { scaleMacros, sumMacros } from './macros';
import { isValidQuantity } from './quantity';
import type { Food, LocalDate, LogEntry, Macros, Meal, MealItem } from './types';

export const MEAL_SERVING_LABEL = 'meal';

export interface MealDraft {
  name: string;
  items: MealItem[];
  favorite: boolean;
}

export type MealDraftField = 'name' | 'items';

export type MealValidation =
  { ok: true } | { ok: false; errors: Partial<Record<MealDraftField, string>> };

export function validateMealDraft(draft: MealDraft): MealValidation {
  const errors: Partial<Record<MealDraftField, string>> = {};
  if (!draft.name.trim()) errors.name = 'Name is required';
  if (draft.items.length === 0) errors.items = 'Add at least one ingredient';
  else if (!draft.items.every((i) => isValidQuantity(i.servings)))
    errors.items = 'Each ingredient needs a quantity greater than 0';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

export interface MealTotals {
  totals: Macros;
  /** Food ids referenced by the meal that no longer exist. */
  missingFoodIds: string[];
}

/** Derives totals from CURRENT ingredient data. Missing foods contribute nothing. */
export function computeMealTotals(
  items: readonly MealItem[],
  foodsById: ReadonlyMap<string, Food>,
): MealTotals {
  const missingFoodIds: string[] = [];
  const parts: Macros[] = [];
  for (const item of items) {
    const food = foodsById.get(item.foodId);
    if (!food) missingFoodIds.push(item.foodId);
    else parts.push(scaleMacros(food.macrosPerServing, item.servings));
  }
  return { totals: sumMacros(parts), missingFoodIds };
}

export function createMeal(draft: MealDraft, opts: { id: string; now: number }): Meal {
  return {
    id: opts.id,
    name: draft.name.trim(),
    items: draft.items.map((i) => ({ ...i })),
    favorite: draft.favorite,
    useCount: 0,
    createdAt: opts.now,
    updatedAt: opts.now,
  };
}

export function updateMeal(meal: Meal, draft: MealDraft, now: number): Meal {
  return {
    ...meal,
    name: draft.name.trim(),
    items: draft.items.map((i) => ({ ...i })),
    favorite: draft.favorite,
    updatedAt: now,
  };
}

export function markMealUsed(meal: Meal, now: number): Meal {
  return { ...meal, lastUsedAt: now, useCount: meal.useCount + 1 };
}

export function mealsUsingFood(meals: readonly Meal[], foodId: string): Meal[] {
  return meals.filter((m) => m.items.some((i) => i.foodId === foodId));
}

/**
 * Snapshots the meal's current derived totals × servings. Refuses to log a meal with
 * deleted ingredients so the entry never silently under-counts.
 */
export function createMealLogEntry(params: {
  id: string;
  meal: Meal;
  foodsById: ReadonlyMap<string, Food>;
  servings: number;
  date: LocalDate;
  timestamp: number;
  label?: string;
}): LogEntry {
  const { meal, servings } = params;
  if (!isValidQuantity(servings)) throw new RangeError('servings must be > 0');
  const { totals, missingFoodIds } = computeMealTotals(meal.items, params.foodsById);
  if (missingFoodIds.length) throw new Error('Meal has deleted ingredients');
  return {
    id: params.id,
    date: params.date,
    timestamp: params.timestamp,
    kind: 'meal',
    refId: meal.id,
    name: meal.name,
    servingLabel: MEAL_SERVING_LABEL,
    servings,
    macros: scaleMacros(totals, servings),
    label: params.label,
  };
}
