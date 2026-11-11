import { timestampForDate } from '../domain/dates';
import { markFoodUsed } from '../domain/food';
import { changeEntryServings, createFoodLogEntry } from '../domain/log';
import { createMealLogEntry, markMealUsed } from '../domain/meal';
import type { Food, LocalDate, LogEntry, Meal } from '../domain/types';
import { repos } from './repos';

/** UUID v4. Falls back to getRandomValues where randomUUID is unavailable (non-HTTPS LAN dev). */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function logFood(food: Food, servings: number, date: LocalDate): Promise<LogEntry> {
  const now = new Date();
  const entry = createFoodLogEntry({
    id: newId(),
    food,
    servings,
    date,
    timestamp: timestampForDate(date, now),
  });
  await repos.log.save(entry);
  await repos.foods.save(markFoodUsed(food, now.getTime()));
  return entry;
}

export async function setEntryServings(entry: LogEntry, servings: number): Promise<void> {
  await repos.log.save(changeEntryServings(entry, servings));
}

export async function loadFoodsById(): Promise<Map<string, Food>> {
  return new Map((await repos.foods.list()).map((f) => [f.id, f]));
}

export async function logMeal(meal: Meal, servings: number, date: LocalDate): Promise<LogEntry> {
  const now = new Date();
  const entry = createMealLogEntry({
    id: newId(),
    meal,
    foodsById: await loadFoodsById(),
    servings,
    date,
    timestamp: timestampForDate(date, now),
  });
  await repos.log.save(entry);
  await repos.meals.save(markMealUsed(meal, now.getTime()));
  return entry;
}
