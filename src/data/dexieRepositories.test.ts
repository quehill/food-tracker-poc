import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFood } from '../domain/food';
import { createFoodLogEntry } from '../domain/log';
import { computeMealTotals } from '../domain/meal';
import { DEFAULT_TARGETS, EARLIEST_DATE, targetsForDate } from '../domain/targets';
import { subscribeToChanges } from './changes';
import { AppDB } from './db';
import { createDexieRepositories } from './dexieRepositories';
import { loadSampleData } from './sampleData';

let dbName: string;
let db: AppDB;

beforeEach(() => {
  dbName = `test-${Math.random()}`;
  db = new AppDB(dbName);
});

afterEach(async () => {
  await db.delete();
});

const food = createFood(
  {
    name: 'Banana',
    servingLabel: '1 medium',
    servingGrams: 118,
    macros: { calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
    favorite: false,
  },
  { id: 'banana', now: 1 },
);

describe('Dexie repositories', () => {
  it('persists foods and log entries across a reopen (simulated reload)', async () => {
    const repos = createDexieRepositories(db);
    await repos.foods.save(food);
    await repos.log.save(
      createFoodLogEntry({ id: 'e1', food, servings: 2, date: '2026-11-10', timestamp: 100 }),
    );
    await repos.settings.setTargets({ calories: 1800, protein: 140 }, '2026-11-10');
    db.close();

    db = new AppDB(dbName);
    const reopened = createDexieRepositories(db);
    expect(await reopened.foods.get('banana')).toEqual(food);
    const entries = await reopened.log.listByDate('2026-11-10');
    expect(entries.map((e) => [e.id, e.macros.calories])).toEqual([['e1', 210]]);
    expect(await reopened.settings.getTargets()).toEqual({ calories: 1800, protein: 140 });
  });

  it('lists log entries for one date in timestamp order', async () => {
    const repos = createDexieRepositories(db);
    const mk = (id: string, date: string, timestamp: number) =>
      createFoodLogEntry({ id, food, servings: 1, date, timestamp });
    await repos.log.save(mk('late', '2026-11-10', 300));
    await repos.log.save(mk('other-day', '2026-11-11', 50));
    await repos.log.save(mk('early', '2026-11-10', 100));
    expect((await repos.log.listByDate('2026-11-10')).map((e) => e.id)).toEqual(['early', 'late']);
  });

  it('returns default targets when none are saved', async () => {
    const repos = createDexieRepositories(db);
    expect(await repos.settings.getTargets()).toEqual(DEFAULT_TARGETS);
    expect(await repos.settings.getTargetHistory()).toEqual([
      { effectiveFrom: EARLIEST_DATE, targets: DEFAULT_TARGETS },
    ]);
  });

  it('lists log entries in an inclusive date range', async () => {
    const repos = createDexieRepositories(db);
    const mk = (id: string, date: string, timestamp: number) =>
      createFoodLogEntry({ id, food, servings: 1, date, timestamp });
    await repos.log.save(mk('before', '2026-11-03', 1));
    await repos.log.save(mk('last', '2026-11-10', 4));
    await repos.log.save(mk('first', '2026-11-04', 2));
    await repos.log.save(mk('middle', '2026-11-07', 3));
    await repos.log.save(mk('after', '2026-11-11', 5));
    const ids = (await repos.log.listByDateRange('2026-11-04', '2026-11-10')).map((e) => e.id);
    expect(ids).toEqual(['first', 'middle', 'last']);
  });

  it('keeps past targets when new targets are saved', async () => {
    const repos = createDexieRepositories(db);
    const old = { calories: 2000, protein: 150 };
    const next = { calories: 1800, protein: 160, carbs: 180, fat: 60 };
    // Simulates data saved before target history existed.
    await db.settings.put({ key: 'targets', value: old });

    await repos.settings.setTargets(next, '2026-11-10');
    expect(await repos.settings.getTargets()).toEqual(next);
    const history = await repos.settings.getTargetHistory();
    expect(history).toEqual([
      { effectiveFrom: EARLIEST_DATE, targets: old },
      { effectiveFrom: '2026-11-10', targets: next },
    ]);
    expect(targetsForDate(history, '2026-11-09')).toEqual(old);
    expect(targetsForDate(history, '2026-11-10')).toEqual(next);
  });

  it('saves and validates the profile', async () => {
    const repos = createDexieRepositories(db);
    expect(await repos.settings.getProfile()).toBeUndefined();
    const profile = {
      sex: 'female' as const,
      age: 30,
      heightCm: 165,
      weightKg: 63,
      activity: 'light' as const,
      goal: 'maintain' as const,
    };
    await repos.settings.setProfile(profile);
    expect(await repos.settings.getProfile()).toEqual(profile);
    await db.settings.put({ key: 'profile', value: { sex: 'x' } });
    expect(await repos.settings.getProfile()).toBeUndefined();
  });

  it('notifies listeners on writes', async () => {
    const repos = createDexieRepositories(db);
    let calls = 0;
    const unsubscribe = subscribeToChanges(() => calls++);
    await repos.foods.save(food);
    await repos.foods.delete(food.id);
    unsubscribe();
    await repos.foods.save(food);
    expect(calls).toBe(2);
  });

  it('loads sample data idempotently, including a turkey sandwich of ~300 kcal', async () => {
    const repos = createDexieRepositories(db);
    expect(await loadSampleData(repos, 1)).toEqual({ foods: 6, meals: 1 });
    expect(await loadSampleData(repos, 2)).toEqual({ foods: 0, meals: 0 });
    expect(await repos.foods.list()).toHaveLength(6);

    const sandwich = await repos.meals.get('sample-turkey-sandwich');
    const foods = new Map((await repos.foods.list()).map((f) => [f.id, f]));
    const { totals, missingFoodIds } = computeMealTotals(sandwich!.items, foods);
    expect(missingFoodIds).toEqual([]);
    expect(totals.calories).toBeGreaterThanOrEqual(300);
    expect(totals.calories).toBeLessThanOrEqual(330);
    expect(totals.protein).toBeGreaterThanOrEqual(20);
    expect(totals.protein).toBeLessThan(30);
  });
});
