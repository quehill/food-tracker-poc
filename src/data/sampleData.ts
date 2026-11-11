import type { FoodDraft } from '../domain/food';
import { createFood } from '../domain/food';
import type { Food } from '../domain/types';
import type { FoodRepository } from './repositories';

const SAMPLE_FOODS: Array<{ id: string; draft: FoodDraft }> = [
  {
    id: 'sample-premier-protein',
    draft: {
      name: 'Premier Protein shake',
      servingLabel: '1 bottle',
      macros: { calories: 160, protein: 30, carbs: 5, fat: 3 },
      favorite: true,
    },
  },
  {
    id: 'sample-egg',
    draft: {
      name: 'Hard-boiled egg',
      servingLabel: '1 large',
      servingGrams: 50,
      macros: { calories: 70, protein: 6, carbs: 0.5, fat: 5 },
      favorite: false,
    },
  },
  {
    id: 'sample-banana',
    draft: {
      name: 'Banana',
      servingLabel: '1 medium',
      servingGrams: 118,
      macros: { calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
      favorite: false,
    },
  },
  {
    id: 'sample-turkey',
    draft: {
      name: 'Deli turkey',
      servingLabel: '3 oz',
      servingGrams: 85,
      macros: { calories: 90, protein: 18, carbs: 2, fat: 1 },
      favorite: false,
    },
  },
  {
    id: 'sample-bread',
    draft: {
      name: 'Sandwich bread',
      servingLabel: '2 slices',
      servingGrams: 56,
      macros: { calories: 140, protein: 6, carbs: 26, fat: 2 },
      favorite: false,
    },
  },
  {
    id: 'sample-cheese',
    draft: {
      name: 'Cheese slice',
      servingLabel: '1 slice',
      servingGrams: 21,
      macros: { calories: 70, protein: 4, carbs: 0.5, fat: 6 },
      favorite: false,
    },
  },
];

/** Adds the sample foods that aren't already present. Returns how many were added. */
export async function loadSampleFoods(foods: FoodRepository, now: number): Promise<number> {
  let added = 0;
  for (const { id, draft } of SAMPLE_FOODS) {
    if (await foods.get(id)) continue;
    const food: Food = createFood(draft, { id, now });
    await foods.save(food);
    added++;
  }
  return added;
}
