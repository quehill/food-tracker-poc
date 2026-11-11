import type { Food, Meal } from './types';

export type QuickItem = { kind: 'food'; item: Food } | { kind: 'meal'; item: Meal };

export const RECENTS_LIMIT = 10;

export function quickItemKey(q: QuickItem): string {
  return `${q.kind}:${q.item.id}`;
}

export function toQuickItems(foods: readonly Food[], meals: readonly Meal[]): QuickItem[] {
  return [
    ...foods.map((item): QuickItem => ({ kind: 'food', item })),
    ...meals.map((item): QuickItem => ({ kind: 'meal', item })),
  ];
}

const byName = (a: QuickItem, b: QuickItem) => a.item.name.localeCompare(b.item.name);
const byLastUsed = (a: QuickItem, b: QuickItem) =>
  (b.item.lastUsedAt ?? 0) - (a.item.lastUsedAt ?? 0);
const byUseCount = (a: QuickItem, b: QuickItem) => b.item.useCount - a.item.useCount;

/** Favorites, most-used first. */
export function favoritesOf(items: readonly QuickItem[]): QuickItem[] {
  return items
    .filter((q) => q.item.favorite)
    .sort((a, b) => byUseCount(a, b) || byLastUsed(a, b) || byName(a, b));
}

/** Previously logged non-favorites, most recent first; use count breaks ties. */
export function recentsOf(items: readonly QuickItem[], limit = RECENTS_LIMIT): QuickItem[] {
  return items
    .filter((q) => !q.item.favorite && q.item.lastUsedAt !== undefined)
    .sort((a, b) => byLastUsed(a, b) || byUseCount(a, b) || byName(a, b))
    .slice(0, limit);
}

function searchText(q: QuickItem): string {
  const brand = q.kind === 'food' ? (q.item.brand ?? '') : '';
  return `${q.item.name} ${brand}`.toLowerCase();
}

/**
 * Every query word must appear in the name (or food brand). Ranked: name starts with the
 * query, then a word starts with it, then other matches; favorites and recent use break ties.
 */
export function searchQuickItems(items: readonly QuickItem[], query: string): QuickItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/);
  const rank = (item: QuickItem): number => {
    const name = item.item.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.split(/\s+/).some((w) => w.startsWith(tokens[0]!))) return 1;
    return 2;
  };
  return items
    .filter((item) => {
      const text = searchText(item);
      return tokens.every((t) => text.includes(t));
    })
    .map((item) => ({ item, rank: rank(item) }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Number(b.item.item.favorite) - Number(a.item.item.favorite) ||
        byLastUsed(a.item, b.item) ||
        byName(a.item, b.item),
    )
    .map((r) => r.item);
}
