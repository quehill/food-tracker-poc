import { atwaterCalories, scaleMacros } from '../../domain/macros';
import type { Macros } from '../../domain/types';
import type { FoodSearchResult } from '../types';

/** FoodData Central nutrient ids. */
export const USDA_NUTRIENT = {
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  energyKcal: 1008,
  energyAtwaterGeneral: 2047,
  energyAtwaterSpecific: 2048,
} as const;

export const GENERIC_DATA_TYPES = ['Foundation', 'SR Legacy'] as const;

export interface UsdaFoodNutrient {
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

export interface UsdaSearchFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaFoodNutrient[];
}

export interface UsdaSearchResponse {
  totalHits?: number;
  foods?: UsdaSearchFood[];
}

function nutrient(food: UsdaSearchFood, id: number, unit?: string): number | undefined {
  const n = food.foodNutrients?.find(
    (x) =>
      x.nutrientId === id &&
      typeof x.value === 'number' &&
      Number.isFinite(x.value) &&
      (!unit || !x.unitName || x.unitName.toUpperCase() === unit),
  );
  // USDA occasionally reports small negative values (e.g. carbs by difference); treat as 0.
  return n?.value === undefined ? undefined : Math.max(0, n.value);
}

/** "TURKEY BREAST" -> "Turkey Breast"; mixed-case text is left alone. */
function tidyCase(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (!/[A-Z]/.test(t) || t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .replace(/(^|[\s(/-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
}

function tidyHousehold(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bONZ\b/gi, 'oz')
    .toLowerCase();
}

function fmtAmount(n: number): string {
  return String(Math.round(n * 10) / 10);
}

type Unit = 'g' | 'ml';

function normalizeUnit(u: string | undefined): Unit | undefined {
  const x = u?.trim().toUpperCase();
  if (x === 'G' || x === 'GRM' || x === 'GM') return 'g';
  if (x === 'ML' || x === 'MLT') return 'ml';
  return undefined;
}

/**
 * Search-result nutrient values are per 100 g (per 100 ml for liquids). Converts to the
 * item's own serving when one is given in g/ml, otherwise to a 100 g serving.
 */
function servingOf(food: UsdaSearchFood): { label: string; grams?: number; per100Factor: number } {
  const unit = normalizeUnit(food.servingSizeUnit);
  const size = food.servingSize;
  if (unit && typeof size === 'number' && size > 0) {
    const amount = `${fmtAmount(size)} ${unit}`;
    const household = food.householdServingFullText?.trim();
    const label = household ? `${tidyHousehold(household)} (${amount})` : amount;
    return { label, grams: unit === 'g' ? size : undefined, per100Factor: size / 100 };
  }
  return { label: '100 g', grams: 100, per100Factor: 1 };
}

export function mapUsdaFood(food: UsdaSearchFood): FoodSearchResult | null {
  const protein = nutrient(food, USDA_NUTRIENT.protein);
  const fat = nutrient(food, USDA_NUTRIENT.fat);
  const carbs = nutrient(food, USDA_NUTRIENT.carbs);
  const energy =
    nutrient(food, USDA_NUTRIENT.energyKcal, 'KCAL') ??
    nutrient(food, USDA_NUTRIENT.energyAtwaterSpecific, 'KCAL') ??
    nutrient(food, USDA_NUTRIENT.energyAtwaterGeneral, 'KCAL');
  if (protein === undefined && fat === undefined && carbs === undefined && energy === undefined)
    return null;

  const macros = { protein: protein ?? 0, carbs: carbs ?? 0, fat: fat ?? 0 };
  const per100: Macros = { calories: energy ?? atwaterCalories(macros), ...macros };
  const serving = servingOf(food);
  const brand = food.brandName?.trim() || food.brandOwner?.trim();

  return {
    provider: 'usda',
    sourceId: String(food.fdcId),
    name: tidyCase(food.description),
    brand: brand ? tidyCase(brand) : undefined,
    gtin: food.gtinUpc?.trim() || undefined,
    serving: { label: serving.label, grams: serving.grams },
    macrosPerServing: scaleMacros(per100, serving.per100Factor),
    caloriesEstimated: energy === undefined,
  };
}

export function mapUsdaFoods(foods: readonly UsdaSearchFood[] | undefined): FoodSearchResult[] {
  return (foods ?? []).flatMap((f) => mapUsdaFood(f) ?? []);
}

function stem(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map(stem);
}

/**
 * Stable re-rank: results whose names contain more of the query words come first.
 * USDA relevance alone can rank e.g. "Rolls, dinner, oat bran" above oats for "rolled oats".
 */
export function rankByQueryMatch(results: FoodSearchResult[], query: string): FoodSearchResult[] {
  const tokens = words(query);
  const score = (r: FoodSearchResult) => {
    const nameWords = words(r.name);
    return tokens.filter((t) => nameWords.some((w) => w.startsWith(t))).length;
  };
  return results
    .map((r, i) => ({ r, i, s: score(r) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.r);
}
