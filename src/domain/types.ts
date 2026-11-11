/** Grams for protein/carbs/fat; kcal for calories. */
export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type MacroKey = keyof Macros;

export type FoodSource = 'custom' | 'usda' | 'off';

export interface Serving {
  label: string;
  grams?: number;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  source: FoodSource;
  sourceId?: string;
  /** Reserved for the barcode phase. */
  gtin?: string;
  serving: Serving;
  /** Macros for ONE serving. */
  macrosPerServing: Macros;
  /** True when calories were derived (Atwater) rather than provided. */
  caloriesEstimated?: boolean;
  favorite: boolean;
  lastUsedAt?: number;
  useCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface MealItem {
  foodId: string;
  servings: number;
}

export interface Meal {
  id: string;
  name: string;
  items: MealItem[];
  favorite: boolean;
  lastUsedAt?: number;
  useCount: number;
  createdAt: number;
  updatedAt: number;
}

/** Local calendar date "YYYY-MM-DD" in the user's timezone. */
export type LocalDate = string;

export interface LogEntry {
  id: string;
  date: LocalDate;
  timestamp: number;
  kind: 'food' | 'meal';
  /** Food or meal id; the referenced item may have been deleted since. */
  refId: string;
  /** Snapshot of the name at log time. */
  name: string;
  /** Snapshot of the serving label at log time (food entries). */
  servingLabel?: string;
  servings: number;
  /** Snapshot of TOTAL macros at log time (already multiplied by servings). */
  macros: Macros;
  label?: string;
}

export interface Targets {
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
}
