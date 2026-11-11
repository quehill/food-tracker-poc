import { describe, expect, it } from 'vitest';
import { createFood, markFoodUsed, updateFood, validateFoodDraft, type FoodDraft } from './food';
import { changeEntryServings, createFoodLogEntry, sortEntries, totalsForEntries } from './log';

const draft: FoodDraft = {
  name: '  Deli turkey ',
  servingLabel: '3 oz',
  servingGrams: 85,
  macros: { calories: 90, protein: 18, carbs: 2, fat: 1 },
  favorite: false,
};

describe('food', () => {
  it('validates required fields and numbers', () => {
    expect(validateFoodDraft(draft)).toEqual({ ok: true });
    const bad = validateFoodDraft({
      ...draft,
      name: ' ',
      servingLabel: '',
      servingGrams: 0,
      macros: { calories: NaN, protein: -1, carbs: 0, fat: 0 },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok)
      expect(Object.keys(bad.errors).sort()).toEqual([
        'calories',
        'name',
        'protein',
        'servingGrams',
        'servingLabel',
      ]);
  });

  it('creates and updates foods', () => {
    const food = createFood(draft, { id: 'f1', now: 1000 });
    expect(food).toMatchObject({ id: 'f1', name: 'Deli turkey', source: 'custom', useCount: 0 });
    const updated = updateFood(food, { ...draft, name: 'Turkey' }, 2000);
    expect(updated).toMatchObject({ name: 'Turkey', createdAt: 1000, updatedAt: 2000 });
    expect(markFoodUsed(updated, 3000)).toMatchObject({ lastUsedAt: 3000, useCount: 1 });
  });

  it('clears the estimated flag when calories are edited', () => {
    const food = { ...createFood(draft, { id: 'f1', now: 1 }), caloriesEstimated: true };
    expect(updateFood(food, draft, 2).caloriesEstimated).toBe(true);
    const edited = { ...draft, macros: { ...draft.macros, calories: 95 } };
    expect(updateFood(food, edited, 2).caloriesEstimated).toBeUndefined();
  });
});

describe('log entries', () => {
  const food = createFood(draft, { id: 'turkey', now: 0 });

  it('snapshots name and multiplied macros at log time', () => {
    const entry = createFoodLogEntry({
      id: 'e1',
      food,
      servings: 2,
      date: '2026-11-10',
      timestamp: 5,
    });
    expect(entry).toMatchObject({
      kind: 'food',
      refId: 'turkey',
      name: 'Deli turkey',
      servingLabel: '3 oz',
      servings: 2,
      macros: { calories: 180, protein: 36, carbs: 4, fat: 2 },
    });
  });

  it('is not affected by later food edits', () => {
    const entry = createFoodLogEntry({ id: 'e1', food, servings: 1, date: 'd', timestamp: 0 });
    const edited = updateFood(
      food,
      { ...draft, name: 'Changed', macros: { calories: 999, protein: 1, carbs: 1, fat: 1 } },
      1,
    );
    expect(edited.name).toBe('Changed');
    expect(entry.name).toBe('Deli turkey');
    expect(entry.macros.calories).toBe(90);
  });

  it('rescales from its own snapshot when servings change', () => {
    const entry = createFoodLogEntry({ id: 'e1', food, servings: 2, date: 'd', timestamp: 0 });
    const changed = changeEntryServings(entry, 0.5);
    expect(changed.servings).toBe(0.5);
    expect(changed.macros).toEqual({ calories: 45, protein: 9, carbs: 1, fat: 0.5 });
  });

  it('rejects invalid servings', () => {
    expect(() =>
      createFoodLogEntry({ id: 'e', food, servings: 0, date: 'd', timestamp: 0 }),
    ).toThrow(RangeError);
    const entry = createFoodLogEntry({ id: 'e', food, servings: 1, date: 'd', timestamp: 0 });
    expect(() => changeEntryServings(entry, NaN)).toThrow(RangeError);
  });

  it('totals and sorts entries', () => {
    const a = createFoodLogEntry({ id: 'a', food, servings: 1, date: 'd', timestamp: 20 });
    const b = createFoodLogEntry({ id: 'b', food, servings: 1.5, date: 'd', timestamp: 10 });
    expect(totalsForEntries([a, b])).toEqual({ calories: 225, protein: 45, carbs: 5, fat: 2.5 });
    expect(sortEntries([a, b]).map((e) => e.id)).toEqual(['b', 'a']);
  });
});
