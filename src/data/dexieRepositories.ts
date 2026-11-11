import { DEFAULT_TARGETS } from '../domain/targets';
import type { Food, LocalDate, LogEntry, Meal, Targets } from '../domain/types';
import { notifyChange } from './changes';
import type { AppDB } from './db';
import type { Repositories } from './repositories';

const TARGETS_KEY = 'targets';

function isTargets(v: unknown): v is Targets {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  return typeof t.calories === 'number' && typeof t.protein === 'number';
}

export function createDexieRepositories(db: AppDB): Repositories {
  return {
    foods: {
      list: () => db.foods.toArray(),
      get: (id) => db.foods.get(id),
      async save(food: Food) {
        await db.foods.put(food);
        notifyChange();
      },
      async delete(id) {
        await db.foods.delete(id);
        notifyChange();
      },
    },
    meals: {
      list: () => db.meals.toArray(),
      get: (id) => db.meals.get(id),
      async save(meal: Meal) {
        await db.meals.put(meal);
        notifyChange();
      },
      async delete(id) {
        await db.meals.delete(id);
        notifyChange();
      },
    },
    log: {
      listByDate: (date: LocalDate) => db.logEntries.where('date').equals(date).sortBy('timestamp'),
      get: (id) => db.logEntries.get(id),
      async save(entry: LogEntry) {
        await db.logEntries.put(entry);
        notifyChange();
      },
      async delete(id) {
        await db.logEntries.delete(id);
        notifyChange();
      },
    },
    settings: {
      async getTargets() {
        const row = await db.settings.get(TARGETS_KEY);
        return isTargets(row?.value) ? row.value : { ...DEFAULT_TARGETS };
      },
      async setTargets(targets: Targets) {
        await db.settings.put({ key: TARGETS_KEY, value: targets });
        notifyChange();
      },
    },
  };
}
