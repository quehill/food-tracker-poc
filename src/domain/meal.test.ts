import { describe, expect, it } from 'vitest';
import { createFood, updateFood, type FoodDraft } from './food';
import { changeEntryServings } from './log';
import {
  computeMealTotals,
  createMeal,
  createMealLogEntry,
  markMealUsed,
  mealsUsingFood,
  updateMeal,
  validateMealDraft,
} from './meal';
import type { Food } from './types';

const mk = (id: string, d: Omit<FoodDraft, 'favorite'>): Food =>
  createFood({ ...d, favorite: false }, { id, now: 0 });

const bread = mk('bread', {
  name: 'Sandwich bread',
  servingLabel: '2 slices',
  servingGrams: 56,
  macros: { calories: 140, protein: 6, carbs: 26, fat: 2 },
});
const turkey = mk('turkey', {
  name: 'Deli turkey',
  servingLabel: '3 oz',
  servingGrams: 85,
  macros: { calories: 90, protein: 18, carbs: 2, fat: 1 },
});
const cheese = mk('cheese', {
  name: 'Cheese slice',
  servingLabel: '1 slice',
  macros: { calories: 70, protein: 4, carbs: 0.5, fat: 6 },
});

const foodsById = (...foods: Food[]) => new Map(foods.map((f) => [f.id, f]));

const sandwich = createMeal(
  {
    name: ' Turkey sandwich ',
    items: [
      { foodId: 'bread', servings: 1 },
      { foodId: 'turkey', servings: 1 },
      { foodId: 'cheese', servings: 1 },
    ],
    favorite: false,
  },
  { id: 'sandwich', now: 0 },
);

describe('meal totals', () => {
  it('derives the turkey sandwich from its ingredients', () => {
    const { totals, missingFoodIds } = computeMealTotals(
      sandwich.items,
      foodsById(bread, turkey, cheese),
    );
    expect(totals).toEqual({ calories: 300, protein: 28, carbs: 28.5, fat: 9 });
    expect(missingFoodIds).toEqual([]);
    expect(sandwich.name).toBe('Turkey sandwich');
  });

  it('scales by per-ingredient servings', () => {
    const { totals } = computeMealTotals(
      [
        { foodId: 'turkey', servings: 2 },
        { foodId: 'cheese', servings: 0.5 },
      ],
      foodsById(turkey, cheese),
    );
    expect(totals).toEqual({ calories: 215, protein: 38, carbs: 4.25, fat: 5 });
  });

  it('reports deleted ingredients and excludes them from totals', () => {
    const { totals, missingFoodIds } = computeMealTotals(sandwich.items, foodsById(bread, turkey));
    expect(missingFoodIds).toEqual(['cheese']);
    expect(totals.calories).toBe(230);
  });

  it('reflects current ingredient data (derived, not stored)', () => {
    const leaner = updateFood(
      turkey,
      {
        name: turkey.name,
        servingLabel: '3 oz',
        servingGrams: 85,
        macros: { calories: 80, protein: 18, carbs: 1, fat: 0.5 },
        favorite: false,
      },
      1,
    );
    expect(
      computeMealTotals(sandwich.items, foodsById(bread, leaner, cheese)).totals.calories,
    ).toBe(290);
  });
});

describe('meal log entries', () => {
  it('snapshots totals × servings at log time', () => {
    const entry = createMealLogEntry({
      id: 'e1',
      meal: sandwich,
      foodsById: foodsById(bread, turkey, cheese),
      servings: 1.5,
      date: '2026-11-10',
      timestamp: 1,
    });
    expect(entry).toMatchObject({
      kind: 'meal',
      refId: 'sandwich',
      name: 'Turkey sandwich',
      servings: 1.5,
      macros: { calories: 450, protein: 42, carbs: 42.75, fat: 13.5 },
    });
  });

  it('is unchanged when an ingredient or the meal is edited afterwards', () => {
    const entry = createMealLogEntry({
      id: 'e1',
      meal: sandwich,
      foodsById: foodsById(bread, turkey, cheese),
      servings: 1,
      date: '2026-11-10',
      timestamp: 1,
    });
    const before = structuredClone(entry);

    const fattierTurkey = updateFood(
      turkey,
      {
        name: 'Changed turkey',
        servingLabel: '3 oz',
        macros: { calories: 500, protein: 1, carbs: 1, fat: 50 },
        favorite: false,
      },
      2,
    );
    const renamed = updateMeal(
      sandwich,
      { name: 'Renamed', items: sandwich.items, favorite: true },
      2,
    );
    const nowTotals = computeMealTotals(renamed.items, foodsById(bread, fattierTurkey, cheese));

    expect(nowTotals.totals.calories).toBe(710);
    expect(entry).toEqual(before);
    expect(entry.macros.calories).toBe(300);
  });

  it('rescales from its own snapshot when servings change', () => {
    const entry = createMealLogEntry({
      id: 'e1',
      meal: sandwich,
      foodsById: foodsById(bread, turkey, cheese),
      servings: 2,
      date: 'd',
      timestamp: 0,
    });
    expect(changeEntryServings(entry, 1).macros).toEqual({
      calories: 300,
      protein: 28,
      carbs: 28.5,
      fat: 9,
    });
  });

  it('refuses to log a meal with deleted ingredients or bad servings', () => {
    const base = { id: 'e', meal: sandwich, date: 'd', timestamp: 0 };
    expect(() =>
      createMealLogEntry({ ...base, foodsById: foodsById(bread, turkey), servings: 1 }),
    ).toThrow();
    expect(() =>
      createMealLogEntry({ ...base, foodsById: foodsById(bread, turkey, cheese), servings: 0 }),
    ).toThrow(RangeError);
  });
});

describe('meal helpers', () => {
  it('validates drafts', () => {
    expect(
      validateMealDraft({ name: 'x', items: [{ foodId: 'a', servings: 1 }], favorite: false }),
    ).toEqual({ ok: true });
    const bad = validateMealDraft({ name: ' ', items: [], favorite: false });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['items', 'name']);
    const badQty = validateMealDraft({
      name: 'x',
      items: [{ foodId: 'a', servings: NaN }],
      favorite: false,
    });
    expect(badQty.ok).toBe(false);
  });

  it('tracks usage and finds meals using a food', () => {
    expect(markMealUsed(sandwich, 5)).toMatchObject({ lastUsedAt: 5, useCount: 1 });
    expect(mealsUsingFood([sandwich], 'turkey').map((m) => m.id)).toEqual(['sandwich']);
    expect(mealsUsingFood([sandwich], 'banana')).toEqual([]);
  });
});
