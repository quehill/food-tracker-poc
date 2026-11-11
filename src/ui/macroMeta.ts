import type { MacroKey } from '../domain/types';

/** Shared names and chart colors so Today and Trends use the same color per macro. */
export const MACRO_META: Readonly<Record<MacroKey, { name: string; color: string }>> = {
  calories: { name: 'Calories', color: 'var(--accent)' },
  protein: { name: 'Protein', color: 'var(--protein)' },
  carbs: { name: 'Carbs', color: 'var(--carbs)' },
  fat: { name: 'Fat', color: 'var(--fat)' },
};

export const SPLIT_KEYS = ['protein', 'carbs', 'fat'] as const;

export function fmtPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
