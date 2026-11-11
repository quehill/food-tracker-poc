import { describe, expect, it } from 'vitest';
import chickenFoundation from './fixtures/chicken-breast-foundation.json';
import premierAny from './fixtures/premier-branded-any-words.json';
import turkeyBranded from './fixtures/turkey-breast-branded.json';
import turkeyGeneric from './fixtures/turkey-breast-generic.json';
import {
  dedupeResults,
  mapUsdaFood,
  mapUsdaFoods,
  rankByQueryMatch,
  type UsdaSearchFood,
  type UsdaSearchResponse,
} from './mapper';

// Fixtures are trimmed real responses from /fdc/v1/foods/search (recorded 2026-11-10).
const generic = turkeyGeneric as UsdaSearchResponse;
const branded = turkeyBranded as UsdaSearchResponse;
const foundation = chickenFoundation as UsdaSearchResponse;

const byId = (r: UsdaSearchResponse, fdcId: number): UsdaSearchFood => {
  const f = r.foods?.find((x) => x.fdcId === fdcId);
  if (!f) throw new Error(`fixture missing ${fdcId}`);
  return f;
};

describe('mapUsdaFood', () => {
  it('maps a generic (SR Legacy) food to a 100 g serving', () => {
    const r = mapUsdaFood(byId(generic, 172941));
    expect(r).toEqual({
      provider: 'usda',
      sourceId: '172941',
      name: 'Turkey breast, sliced, prepackaged',
      brand: undefined,
      gtin: undefined,
      serving: { label: '100 g', grams: 100 },
      macrosPerServing: { calories: 106, protein: 14.8, carbs: 2.2, fat: 3.77 },
      caloriesEstimated: false,
    });
  });

  it('converts branded per-100 g values to the labeled serving', () => {
    const r = mapUsdaFood(byId(branded, 2440897))!;
    expect(r.name).toBe('Turkey Breast');
    expect(r.brand).toBe('Diestel');
    expect(r.gtin).toBe('707330377467');
    expect(r.serving).toEqual({ label: '2 oz (57 g)', grams: 57 });
    expect(r.macrosPerServing.calories).toBeCloseTo(123 * 0.57, 6);
    expect(r.macrosPerServing.protein).toBeCloseTo(28.1 * 0.57, 6);
    expect(r.macrosPerServing.fat).toBeCloseTo(0.88 * 0.57, 6);
    expect(r.macrosPerServing.carbs).toBe(0);
    expect(r.caloriesEstimated).toBe(false);
  });

  it('uses USDA Atwater energy (2048) when 1008 is absent, without marking it estimated', () => {
    const r = mapUsdaFood(byId(foundation, 2646170))!;
    expect(r.macrosPerServing.calories).toBe(112);
    expect(r.caloriesEstimated).toBe(false);
  });

  it('clamps negative nutrient values to 0', () => {
    expect(mapUsdaFood(byId(foundation, 2727569))!.macrosPerServing.carbs).toBe(0);
  });

  it('falls back to an Atwater estimate when no energy value exists', () => {
    const r = mapUsdaFood({
      fdcId: 1,
      description: 'No energy food',
      foodNutrients: [
        { nutrientId: 1003, unitName: 'G', value: 20 },
        { nutrientId: 1004, unitName: 'G', value: 2 },
        { nutrientId: 1005, unitName: 'G', value: 1 },
      ],
    })!;
    expect(r.macrosPerServing.calories).toBe(4 * 20 + 4 * 1 + 9 * 2);
    expect(r.caloriesEstimated).toBe(true);
  });

  it('ignores kJ energy', () => {
    const r = mapUsdaFood({
      fdcId: 2,
      description: 'kJ only',
      foodNutrients: [
        { nutrientId: 1008, unitName: 'kJ', value: 400 },
        { nutrientId: 1003, unitName: 'G', value: 10 },
      ],
    })!;
    expect(r.macrosPerServing.calories).toBe(40);
    expect(r.caloriesEstimated).toBe(true);
  });

  it('handles ml servings without inventing grams', () => {
    const r = mapUsdaFood({
      fdcId: 3,
      description: 'BROTH',
      servingSize: 240,
      servingSizeUnit: 'MLT',
      householdServingFullText: '1 CUP',
      foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 5 }],
    })!;
    expect(r.serving).toEqual({ label: '1 cup (240 ml)', grams: undefined });
    expect(r.macrosPerServing.calories).toBe(12);
  });

  it('drops foods with no usable nutrients', () => {
    expect(mapUsdaFood({ fdcId: 4, description: 'Empty', foodNutrients: [] })).toBeNull();
  });
});

describe('mapUsdaFoods', () => {
  it('maps every fixture food', () => {
    expect(mapUsdaFoods(generic.foods)).toHaveLength(generic.foods!.length);
    expect(mapUsdaFoods(branded.foods)).toHaveLength(branded.foods!.length);
    expect(mapUsdaFoods(foundation.foods)).toHaveLength(foundation.foods!.length);
    expect(mapUsdaFoods(undefined)).toEqual([]);
  });
});

describe('rankByQueryMatch', () => {
  const named = (name: string) =>
    mapUsdaFood({
      fdcId: name.length,
      description: name,
      foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 1 }],
    })!;

  it('moves names containing more query words first, keeping USDA order otherwise', () => {
    const ranked = rankByQueryMatch(
      [
        named('Rolls, dinner, oat bran'),
        named('Cereals, oats, regular, dry'),
        named('Oats, rolled'),
      ],
      'rolled oats',
    );
    expect(ranked.map((r) => r.name)).toEqual([
      'Oats, rolled',
      'Rolls, dinner, oat bran',
      'Cereals, oats, regular, dry',
    ]);
  });

  it('counts brand words, so the actual product beats partial name matches', () => {
    // USDA's any-word order: Toll House "Premier White" first, the Premier Protein shake 6th.
    const ranked = rankByQueryMatch(
      mapUsdaFoods((premierAny as UsdaSearchResponse).foods),
      'premier protein shake',
    );
    expect(ranked[0]).toMatchObject({ name: 'High Protein Shake', brand: 'Premier Protein' });
    expect(ranked.slice(-3).every((r) => r.name.startsWith('Premier White'))).toBe(true);
  });
});

describe('dedupeResults', () => {
  it('keeps the first occurrence of each item', () => {
    const all = mapUsdaFoods(branded.foods);
    expect(dedupeResults([...all, ...all])).toEqual(all);
  });
});
