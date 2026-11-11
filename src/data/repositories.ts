import type { Food, LocalDate, LogEntry, Meal, Targets } from '../domain/types';

export interface FoodRepository {
  list(): Promise<Food[]>;
  get(id: string): Promise<Food | undefined>;
  save(food: Food): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface MealRepository {
  list(): Promise<Meal[]>;
  get(id: string): Promise<Meal | undefined>;
  save(meal: Meal): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface LogRepository {
  listByDate(date: LocalDate): Promise<LogEntry[]>;
  get(id: string): Promise<LogEntry | undefined>;
  save(entry: LogEntry): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepository {
  getTargets(): Promise<Targets>;
  setTargets(targets: Targets): Promise<void>;
}

export interface Repositories {
  foods: FoodRepository;
  meals: MealRepository;
  log: LogRepository;
  settings: SettingsRepository;
}
