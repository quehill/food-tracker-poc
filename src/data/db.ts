import Dexie, { type Table } from 'dexie';
import type { Food, LogEntry, Meal } from '../domain/types';

export interface SettingRow {
  key: string;
  value: unknown;
}

export const DB_NAME = 'macro-tracker';

/**
 * IndexedDB schema. Bump the version and add an upgrade() for any schema change;
 * never edit a published version in place.
 */
export class AppDB extends Dexie {
  foods!: Table<Food, string>;
  meals!: Table<Meal, string>;
  logEntries!: Table<LogEntry, string>;
  settings!: Table<SettingRow, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      foods: 'id, name, lastUsedAt',
      meals: 'id, name, lastUsedAt',
      logEntries: 'id, date, timestamp, refId',
      settings: 'key',
    });
  }
}
