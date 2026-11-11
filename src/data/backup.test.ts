import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFood } from '../domain/food';
import { createFoodLogEntry } from '../domain/log';
import { createMealLogEntry } from '../domain/meal';
import {
  BACKUP_SCHEMA_VERSION,
  createBackupFile,
  parseBackup,
  serializeBackup,
  type BackupData,
} from './backup';
import { AppDB } from './db';
import { createDexieRepositories } from './dexieRepositories';
import { loadSampleData } from './sampleData';

let db: AppDB;

beforeEach(() => {
  db = new AppDB(`backup-${Math.random()}`);
});

afterEach(async () => {
  await db.delete();
});

async function seed() {
  const repos = createDexieRepositories(db);
  await loadSampleData(repos, 1);
  const egg = (await repos.foods.get('sample-egg'))!;
  const sandwich = (await repos.meals.get('sample-turkey-sandwich'))!;
  const foodsById = new Map((await repos.foods.list()).map((f) => [f.id, f]));
  await repos.log.save(
    createFoodLogEntry({ id: 'e1', food: egg, servings: 1.5, date: '2026-11-09', timestamp: 10 }),
  );
  await repos.log.save(
    createMealLogEntry({
      id: 'e2',
      meal: sandwich,
      foodsById,
      servings: 1,
      date: '2026-11-10',
      timestamp: 20,
      label: 'lunch, "big"',
    }),
  );
  await repos.settings.setTargets({ calories: 1900, protein: 160, fat: 70 });
  await repos.settings.setLastBackupAt(999);
  return repos;
}

describe('JSON backup', () => {
  it('round-trips: export, wipe, import gives identical data', async () => {
    const repos = await seed();
    const before = await repos.backup.exportData();
    const json = serializeBackup(createBackupFile(before, new Date('2026-11-10T12:00:00Z')));

    await repos.backup.clearAll();
    expect(await repos.foods.list()).toEqual([]);
    expect(await repos.log.listAll()).toEqual([]);

    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await repos.backup.replaceAll(parsed.data);

    const after = await repos.backup.exportData();
    const sortById = <T extends { id: string }>(xs: T[]) =>
      [...xs].sort((a, b) => a.id.localeCompare(b.id));
    expect(sortById(after.foods)).toEqual(sortById(before.foods));
    expect(sortById(after.meals)).toEqual(sortById(before.meals));
    expect(sortById(after.logEntries)).toEqual(sortById(before.logEntries));
    expect(after.settings).toEqual(before.settings);
    expect(await repos.settings.getTargets()).toEqual({ calories: 1900, protein: 160, fat: 70 });
  });

  it('excludes the device-local last-backup time from exports and keeps it on restore', async () => {
    const repos = await seed();
    const data = await repos.backup.exportData();
    expect(data.settings.map((s) => s.key)).toEqual(['targets']);
    await repos.backup.replaceAll({ ...data, foods: [] });
    expect(await repos.settings.getLastBackupAt()).toBe(999);
    expect(await repos.foods.list()).toEqual([]);
  });

  it('replaces existing data rather than merging', async () => {
    const repos = await seed();
    const extra = createFood(
      {
        name: 'Extra',
        servingLabel: '1',
        macros: { calories: 1, protein: 0, carbs: 0, fat: 0 },
        favorite: false,
      },
      { id: 'extra', now: 0 },
    );
    const snapshot = await repos.backup.exportData();
    await repos.foods.save(extra);
    await repos.backup.replaceAll(snapshot);
    expect(await repos.foods.get('extra')).toBeUndefined();
  });
});

describe('parseBackup', () => {
  const empty: BackupData = { foods: [], meals: [], logEntries: [], settings: [] };
  const file = (overrides: Record<string, unknown>) =>
    JSON.stringify({ ...createBackupFile(empty, new Date(0)), ...overrides });

  it('accepts a valid empty backup', () => {
    expect(parseBackup(file({}))).toMatchObject({ ok: true, schemaVersion: BACKUP_SCHEMA_VERSION });
  });

  it('rejects non-JSON, other files, and newer schema versions', () => {
    expect(parseBackup('{nope')).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false });
    expect(parseBackup(file({ schemaVersion: BACKUP_SCHEMA_VERSION + 1 }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('newer version'),
    });
    expect(parseBackup(file({ schemaVersion: 'x' }))).toMatchObject({ ok: false });
  });

  it('rejects missing sections and invalid records, naming the record', () => {
    expect(parseBackup(file({ meals: undefined }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('meals'),
    });
    const badEntry = { id: 'x', date: 'yesterday', timestamp: 1 };
    expect(parseBackup(file({ logEntries: [badEntry] }))).toMatchObject({
      ok: false,
      error: expect.stringContaining('logEntries[0]'),
    });
  });
});
