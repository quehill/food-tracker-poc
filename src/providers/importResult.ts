import { createFood } from '../domain/food';
import type { Food, FoodSource } from '../domain/types';
import type { FoodSearchResult } from './types';

function sourceOf(provider: string): FoodSource {
  return provider === 'off' ? 'off' : 'usda';
}

/** Converts a lookup result into an editable Food for My Foods. */
export function foodFromSearchResult(r: FoodSearchResult, opts: { id: string; now: number }): Food {
  const food = createFood(
    {
      name: r.name,
      brand: r.brand,
      servingLabel: r.serving.label,
      servingGrams: r.serving.grams,
      macros: { ...r.macrosPerServing },
      favorite: false,
    },
    { ...opts, source: sourceOf(r.provider), sourceId: r.sourceId },
  );
  return {
    ...food,
    gtin: r.gtin,
    caloriesEstimated: r.caloriesEstimated || undefined,
  };
}

export function findImported(foods: readonly Food[], r: FoodSearchResult): Food | undefined {
  const source = sourceOf(r.provider);
  return foods.find((f) => f.source === source && f.sourceId === r.sourceId);
}
