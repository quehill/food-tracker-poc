import type { Food, LocalDate, LogEntry, Targets } from '../domain/types';

export interface FoodRepository {
  list(): Promise<Food[]>;
  get(id: string): Promise<Food | undefined>;
  save(food: Food): Promise<void>;
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
  log: LogRepository;
  settings: SettingsRepository;
}
