import { scaleMacros, sumMacros } from './macros';
import { isValidQuantity } from './quantity';
import type { Food, LocalDate, LogEntry, Macros } from './types';

/** Snapshots the food's current name and macros so later edits never rewrite history. */
export function createFoodLogEntry(params: {
  id: string;
  food: Food;
  servings: number;
  date: LocalDate;
  timestamp: number;
  label?: string;
}): LogEntry {
  const { food, servings } = params;
  if (!isValidQuantity(servings)) throw new RangeError('servings must be > 0');
  return {
    id: params.id,
    date: params.date,
    timestamp: params.timestamp,
    kind: 'food',
    refId: food.id,
    name: food.name,
    servingLabel: food.serving.label,
    servings,
    macros: scaleMacros(food.macrosPerServing, servings),
    label: params.label,
  };
}

/** Rescales the entry's own snapshot; never consults the current food. */
export function changeEntryServings(entry: LogEntry, servings: number): LogEntry {
  if (!isValidQuantity(servings)) throw new RangeError('servings must be > 0');
  if (!isValidQuantity(entry.servings)) throw new RangeError('entry has invalid servings');
  return { ...entry, servings, macros: scaleMacros(entry.macros, servings / entry.servings) };
}

export function totalsForEntries(entries: readonly LogEntry[]): Macros {
  return sumMacros(entries.map((e) => e.macros));
}

export function sortEntries(entries: readonly LogEntry[]): LogEntry[] {
  return [...entries].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
}
