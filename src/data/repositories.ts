import type { Profile } from '../domain/energy';
import type { TargetHistory } from '../domain/targets';
import type { Food, LocalDate, LogEntry, Meal, Targets } from '../domain/types';
import type { BackupData } from './backup';

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
  /** Entries with `from <= date <= to`, in timestamp order. */
  listByDateRange(from: LocalDate, to: LocalDate): Promise<LogEntry[]>;
  listAll(): Promise<LogEntry[]>;
  get(id: string): Promise<LogEntry | undefined>;
  save(entry: LogEntry): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepository {
  /** The most recently saved targets. */
  getTargets(): Promise<Targets>;
  /** Saves targets in effect from `effectiveFrom` onward; earlier days keep their targets. */
  setTargets(targets: Targets, effectiveFrom: LocalDate): Promise<void>;
  /** Never empty: without saved history, the current targets cover all dates. */
  getTargetHistory(): Promise<TargetHistory>;
  getProfile(): Promise<Profile | undefined>;
  setProfile(profile: Profile): Promise<void>;
  getLastBackupAt(): Promise<number | undefined>;
  setLastBackupAt(timestamp: number): Promise<void>;
}

export interface BackupRepository {
  /** Everything needed to restore the app, excluding device-local settings. */
  exportData(): Promise<BackupData>;
  /** Atomically replaces all user data with `data`. */
  replaceAll(data: BackupData): Promise<void>;
  clearAll(): Promise<void>;
}

export interface Repositories {
  foods: FoodRepository;
  meals: MealRepository;
  log: LogRepository;
  settings: SettingsRepository;
  backup: BackupRepository;
}
