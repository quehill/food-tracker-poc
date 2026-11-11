import type { Food, LogEntry, Meal } from '../domain/types';
import type { SettingRow } from './db';

export const BACKUP_APP_ID = 'macro-tracker';
/** Bump when the backup shape changes, and add a migration below for the previous version. */
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupData {
  foods: Food[];
  meals: Meal[];
  logEntries: LogEntry[];
  settings: SettingRow[];
}

export interface BackupFile extends BackupData {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
}

export function createBackupFile(data: BackupData, now: Date): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    ...data,
  };
}

export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

export function backupFilename(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `macro-tracker-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isOptStr = (v: unknown) => v === undefined || isStr(v);
const isOptNum = (v: unknown) => v === undefined || isNum(v);

function isMacros(v: unknown): boolean {
  return isObj(v) && isNum(v.calories) && isNum(v.protein) && isNum(v.carbs) && isNum(v.fat);
}

function isFood(v: unknown): v is Food {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.name) &&
    isOptStr(v.brand) &&
    (v.source === 'custom' || v.source === 'usda' || v.source === 'off') &&
    isOptStr(v.sourceId) &&
    isOptStr(v.gtin) &&
    isObj(v.serving) &&
    isStr(v.serving.label) &&
    isOptNum(v.serving.grams) &&
    isMacros(v.macrosPerServing) &&
    (v.caloriesEstimated === undefined || typeof v.caloriesEstimated === 'boolean') &&
    typeof v.favorite === 'boolean' &&
    isOptNum(v.lastUsedAt) &&
    isNum(v.useCount) &&
    isNum(v.createdAt) &&
    isNum(v.updatedAt)
  );
}

function isMeal(v: unknown): v is Meal {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.name) &&
    Array.isArray(v.items) &&
    v.items.every((i) => isObj(i) && isStr(i.foodId) && isNum(i.servings)) &&
    typeof v.favorite === 'boolean' &&
    isOptNum(v.lastUsedAt) &&
    isNum(v.useCount) &&
    isNum(v.createdAt) &&
    isNum(v.updatedAt)
  );
}

function isLogEntry(v: unknown): v is LogEntry {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.date) &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
    isNum(v.timestamp) &&
    (v.kind === 'food' || v.kind === 'meal') &&
    isStr(v.refId) &&
    isStr(v.name) &&
    isOptStr(v.servingLabel) &&
    isNum(v.servings) &&
    isMacros(v.macros) &&
    isOptStr(v.label)
  );
}

function isSettingRow(v: unknown): v is SettingRow {
  return isObj(v) && isStr(v.key) && 'value' in v;
}

// Keyed by the version being migrated FROM; each step returns the next version's shape.
const MIGRATIONS: Record<number, (data: Obj) => Obj> = {};

export type ParsedBackup =
  | { ok: true; data: BackupData; exportedAt?: string; schemaVersion: number }
  | { ok: false; error: string };

export function parseBackup(json: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP_ID)
    return { ok: false, error: "This file isn't a Macro Tracker backup." };
  const version = raw.schemaVersion;
  if (!isNum(version) || !Number.isInteger(version) || version < 1)
    return { ok: false, error: 'The backup has no valid schema version.' };
  if (version > BACKUP_SCHEMA_VERSION)
    return {
      ok: false,
      error: `This backup is from a newer version of the app (schema ${version}). Update the app first.`,
    };

  let doc: Obj = raw;
  for (let v = version; v < BACKUP_SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) return { ok: false, error: `No migration from schema ${v}.` };
    doc = migrate(doc);
  }

  const checks = [
    ['foods', isFood],
    ['meals', isMeal],
    ['logEntries', isLogEntry],
    ['settings', isSettingRow],
  ] as const;
  for (const [key, check] of checks) {
    const list = doc[key];
    if (!Array.isArray(list)) return { ok: false, error: `The backup is missing "${key}".` };
    const bad = list.findIndex((item) => !check(item));
    if (bad !== -1)
      return { ok: false, error: `The backup has an invalid record: ${key}[${bad}].` };
  }

  return {
    ok: true,
    schemaVersion: version,
    exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : undefined,
    data: {
      foods: doc.foods as Food[],
      meals: doc.meals as Meal[],
      logEntries: doc.logEntries as LogEntry[],
      settings: doc.settings as SettingRow[],
    },
  };
}
