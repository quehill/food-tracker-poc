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

/** Non-branded data types. FNDDS (survey foods) covers mixed dishes and restaurant items. */
export const GENERIC_DATA_TYPES = ['Foundation', 'SR Legacy', 'Survey (FNDDS)'] as const;

export interface UsdaFoodNutrient {
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

export interface UsdaFoodMeasure {
  disseminationText?: string;
  gramWeight?: number;
  rank?: number;
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
  foodMeasures?: UsdaFoodMeasure[];
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
 * FNDDS portion for the item itself, e.g. "1 double cheeseburger" = 140 g. USDA's rank 1 isn't
 * always that (Big Mac's rank 1 is "1 McDonald's Mac Jr"), so portions sharing more words with
 * the description win; rank breaks ties.
 */
function surveyPortion(food: UsdaSearchFood): { text: string; grams: number } | undefined {
  if (food.dataType !== 'Survey (FNDDS)') return undefined;
  const descWords = new Set(words(food.description));
  const overlap = (text: string) =>
    words(text).filter((w) => w.length > 1 && descWords.has(w)).length;
  const m = (food.foodMeasures ?? [])
    .filter(
      (x) =>
        typeof x.gramWeight === 'number' &&
        x.gramWeight > 0 &&
        !!x.disseminationText?.trim() &&
        !/quantity not specified/i.test(x.disseminationText),
    )
    .map((x) => ({ x, overlap: overlap(x.disseminationText!) }))
    .sort((a, b) => b.overlap - a.overlap || (a.x.rank ?? Infinity) - (b.x.rank ?? Infinity))[0]?.x;
  return m ? { text: m.disseminationText!.trim(), grams: m.gramWeight! } : undefined;
}

/**
 * Search-result nutrient values are per 100 g (per 100 ml for liquids). Converts to the
 * item's labeled serving (branded) or its main portion (FNDDS), otherwise to 100 g.
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
  const portion = surveyPortion(food);
  if (portion) {
    return {
      label: `${portion.text} (${fmtAmount(portion.grams)} g)`,
      grams: portion.grams,
      per100Factor: portion.grams / 100,
    };
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
 * Stable re-rank: results matching more query words (in name or brand) come first; among
 * those, more matches in the name itself. USDA relevance alone can rank e.g. "Rolls, dinner,
 * oat bran" above oats for "rolled oats", or Toll House "Premier White" above Premier Protein.
 */
export function rankByQueryMatch(results: FoodSearchResult[], query: string): FoodSearchResult[] {
  const tokens = words(query);
  const matches = (ws: string[]) => tokens.filter((t) => ws.some((w) => w.startsWith(t))).length;
  return results
    .map((r, i) => {
      const nameWords = words(r.name);
      return {
        r,
        i,
        all: matches([...nameWords, ...words(r.brand ?? '')]),
        name: matches(nameWords),
      };
    })
    .sort((a, b) => b.all - a.all || b.name - a.name || a.i - b.i)
    .map((x) => x.r);
}

/** Keeps the first occurrence of each sourceId. */
export function dedupeResults(results: FoodSearchResult[]): FoodSearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => !seen.has(r.sourceId) && !!seen.add(r.sourceId));
}
