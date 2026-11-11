export interface FoodSearchResult {
  provider: string;
  sourceId: string;
  name: string;
  brand?: string;
  gtin?: string;
  serving: { label: string; grams?: number };
  macrosPerServing: { calories: number; protein: number; carbs: number; fat: number };
  caloriesEstimated: boolean;
}

/** Every lookup source (USDA now; Open Food Facts / barcode later) implements this. */
export interface FoodProvider {
  id: 'usda' | 'off' | (string & {});
  search(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]>;
  getByBarcode?(code: string, signal?: AbortSignal): Promise<FoodSearchResult | null>;
}
