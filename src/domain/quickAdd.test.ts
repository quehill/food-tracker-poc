import { describe, expect, it } from 'vitest';
import { createFood } from './food';
import { createMeal } from './meal';
import {
  favoritesOf,
  quickItemKey,
  recentsOf,
  searchQuickItems,
  toQuickItems,
  type QuickItem,
} from './quickAdd';
import type { Food, Meal } from './types';

function food(id: string, name: string, extra: Partial<Food> = {}): Food {
  return {
    ...createFood(
      {
        name,
        servingLabel: '1',
        macros: { calories: 1, protein: 0, carbs: 0, fat: 0 },
        favorite: false,
      },
      { id, now: 0 },
    ),
    ...extra,
  };
}

function meal(id: string, name: string, extra: Partial<Meal> = {}): Meal {
  return {
    ...createMeal({ name, items: [{ foodId: 'x', servings: 1 }], favorite: false }, { id, now: 0 }),
    ...extra,
  };
}

const keys = (items: QuickItem[]) => items.map(quickItemKey);

describe('favorites and recents', () => {
  const items = toQuickItems(
    [
      food('shake', 'Protein shake', { favorite: true, useCount: 10, lastUsedAt: 100 }),
      food('egg', 'Egg', { favorite: true, useCount: 3, lastUsedAt: 500 }),
      food('banana', 'Banana', { useCount: 1, lastUsedAt: 400 }),
      food('bread', 'Bread', { useCount: 5, lastUsedAt: 400 }),
      food('never', 'Never used'),
    ],
    [meal('sandwich', 'Turkey sandwich', { useCount: 2, lastUsedAt: 450 })],
  );

  it('lists favorites by use count', () => {
    expect(keys(favoritesOf(items))).toEqual(['food:shake', 'food:egg']);
  });

  it('lists used non-favorites by recency, then use count', () => {
    expect(keys(recentsOf(items))).toEqual(['meal:sandwich', 'food:bread', 'food:banana']);
  });

  it('limits recents', () => {
    expect(recentsOf(items, 1)).toHaveLength(1);
  });
});

describe('searchQuickItems', () => {
  const items = toQuickItems(
    [
      food('turkey', 'Deli turkey', { brand: 'Boar' }),
      food('tbreast', 'Turkey breast'),
      food('ham', 'Ham', { brand: 'Turkey Hill' }),
      food('fav', 'Smoked turkey', { favorite: true }),
    ],
    [meal('sandwich', 'Turkey sandwich', { lastUsedAt: 50 })],
  );

  it('searches foods and meals together, ranking prefix matches first', () => {
    expect(keys(searchQuickItems(items, 'turkey'))).toEqual([
      'meal:sandwich', // prefix, recently used
      'food:tbreast', // prefix
      'food:fav', // word match, favorite
      'food:turkey', // word match
      'food:ham', // brand-only match
    ]);
  });

  it('requires every word and ignores case', () => {
    expect(keys(searchQuickItems(items, 'TURKEY sand'))).toEqual(['meal:sandwich']);
    expect(keys(searchQuickItems(items, 'deli boar'))).toEqual(['food:turkey']);
  });

  it('returns nothing for an empty query', () => {
    expect(searchQuickItems(items, '  ')).toEqual([]);
  });
});
