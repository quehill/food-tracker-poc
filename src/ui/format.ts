import { addDays, parseLocalDate } from '../domain/dates';
import { roundCalories, roundGrams } from '../domain/macros';
import type { LocalDate, Macros } from '../domain/types';

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const servingsFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function fmtKcal(value: number): string {
  return numberFmt.format(roundCalories(value));
}

export function fmtGrams(value: number): string {
  return numberFmt.format(roundGrams(value));
}

export function fmtServings(value: number): string {
  return servingsFmt.format(value);
}

export function macroLine(m: Macros): string {
  return `${fmtKcal(m.calories)} kcal · P ${fmtGrams(m.protein)} · C ${fmtGrams(m.carbs)} · F ${fmtGrams(m.fat)}`;
}

export function fmtDateLabel(date: LocalDate, today: LocalDate): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function fmtTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** Up to 2 decimals for prefilled numeric inputs. */
export function toInputValue(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '';
  return String(Math.round(value * 100) / 100);
}
