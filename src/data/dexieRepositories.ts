import { isProfile, type Profile } from '../domain/energy';
import {
  DEFAULT_TARGETS,
  EARLIEST_DATE,
  isTargetHistory,
  isTargets,
  withTargets,
  type TargetHistory,
} from '../domain/targets';
import type { Food, LocalDate, LogEntry, Meal, Targets } from '../domain/types';
import { notifyChange } from './changes';
import type { BackupData } from './backup';
import type { AppDB } from './db';
import type { Repositories } from './repositories';

/** Latest targets; kept alongside the history so older app versions and backups still read it. */
const TARGETS_KEY = 'targets';
const TARGET_HISTORY_KEY = 'targetHistory';
const PROFILE_KEY = 'profile';
/** Device-local: excluded from backups and kept when a backup is restored. */
const LAST_BACKUP_KEY = 'lastBackupAt';
const LOCAL_SETTING_KEYS = new Set([LAST_BACKUP_KEY]);

export function createDexieRepositories(db: AppDB): Repositories {
  const getTargets = async (): Promise<Targets> => {
    const row = await db.settings.get(TARGETS_KEY);
    return isTargets(row?.value) ? row.value : { ...DEFAULT_TARGETS };
  };

  const getTargetHistory = async (): Promise<TargetHistory> => {
    const v = (await db.settings.get(TARGET_HISTORY_KEY))?.value;
    if (isTargetHistory(v) && v.length > 0) return v;
    // Data from before target history existed: current targets apply to every day.
    return [{ effectiveFrom: EARLIEST_DATE, targets: await getTargets() }];
  };
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
      listByDateRange: (from: LocalDate, to: LocalDate) =>
        db.logEntries.where('date').between(from, to, true, true).sortBy('timestamp'),
      listAll: () => db.logEntries.orderBy('timestamp').toArray(),
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
      getTargets,
      getTargetHistory,
      async setTargets(targets: Targets, effectiveFrom: LocalDate) {
        await db.transaction('rw', db.settings, async () => {
          const history = withTargets(await getTargetHistory(), targets, effectiveFrom);
          await db.settings.bulkPut([
            { key: TARGET_HISTORY_KEY, value: history },
            { key: TARGETS_KEY, value: targets },
          ]);
        });
        notifyChange();
      },
      async getProfile() {
        const v = (await db.settings.get(PROFILE_KEY))?.value;
        return isProfile(v) ? v : undefined;
      },
      async setProfile(profile: Profile) {
        await db.settings.put({ key: PROFILE_KEY, value: profile });
        notifyChange();
      },
      async getLastBackupAt() {
        const v = (await db.settings.get(LAST_BACKUP_KEY))?.value;
        return typeof v === 'number' ? v : undefined;
      },
      async setLastBackupAt(timestamp: number) {
        await db.settings.put({ key: LAST_BACKUP_KEY, value: timestamp });
        notifyChange();
      },
    },
    backup: {
      exportData: () =>
        db.transaction('r', [db.foods, db.meals, db.logEntries, db.settings], async () => ({
          foods: await db.foods.toArray(),
          meals: await db.meals.toArray(),
          logEntries: await db.logEntries.toArray(),
          settings: (await db.settings.toArray()).filter((s) => !LOCAL_SETTING_KEYS.has(s.key)),
        })),
      async replaceAll(data: BackupData) {
        await db.transaction('rw', [db.foods, db.meals, db.logEntries, db.settings], async () => {
          await Promise.all([db.foods.clear(), db.meals.clear(), db.logEntries.clear()]);
          await db.settings
            .where('key')
            .noneOf([...LOCAL_SETTING_KEYS])
            .delete();
          await db.foods.bulkPut(data.foods);
          await db.meals.bulkPut(data.meals);
          await db.logEntries.bulkPut(data.logEntries);
          await db.settings.bulkPut(data.settings.filter((s) => !LOCAL_SETTING_KEYS.has(s.key)));
        });
        notifyChange();
      },
      async clearAll() {
        await db.transaction('rw', [db.foods, db.meals, db.logEntries, db.settings], () =>
          Promise.all([
            db.foods.clear(),
            db.meals.clear(),
            db.logEntries.clear(),
            db.settings.clear(),
          ]),
        );
        notifyChange();
      },
    },
  };
}
