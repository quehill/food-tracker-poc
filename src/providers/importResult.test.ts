import { describe, expect, it } from 'vitest';
import { findImported, foodFromSearchResult } from './importResult';
import type { FoodSearchResult } from './types';

const result: FoodSearchResult = {
  provider: 'usda',
  sourceId: '2440897',
  name: 'Turkey Breast',
  brand: 'Diestel',
  gtin: '707330377467',
  serving: { label: '2 oz (57 g)', grams: 57 },
  macrosPerServing: { calories: 70.11, protein: 16.017, carbs: 0, fat: 0.5016 },
  caloriesEstimated: false,
};

describe('foodFromSearchResult', () => {
  it('creates an editable USDA food with exact (unrounded) macros', () => {
    const food = foodFromSearchResult(result, { id: 'f1', now: 5 });
    expect(food).toMatchObject({
      id: 'f1',
      name: 'Turkey Breast',
      brand: 'Diestel',
      source: 'usda',
      sourceId: '2440897',
      gtin: '707330377467',
      serving: { label: '2 oz (57 g)', grams: 57 },
      macrosPerServing: result.macrosPerServing,
      favorite: false,
      useCount: 0,
      createdAt: 5,
    });
    expect(food.caloriesEstimated).toBeUndefined();
  });

  it('carries the estimated-calories flag', () => {
    expect(
      foodFromSearchResult({ ...result, caloriesEstimated: true }, { id: 'f', now: 0 })
        .caloriesEstimated,
    ).toBe(true);
  });

  it('finds an already-imported food by source id', () => {
    const food = foodFromSearchResult(result, { id: 'f1', now: 0 });
    expect(findImported([food], result)).toBe(food);
    expect(findImported([food], { ...result, sourceId: '1' })).toBeUndefined();
  });
});
