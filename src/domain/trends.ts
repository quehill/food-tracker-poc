import { addDays } from './dates';
import { sumMacros, ZERO_MACROS } from './macros';
import { targetsForDate, type TargetPeriod } from './targets';
import type { LocalDate, LogEntry, Macros, Targets } from './types';

export interface DaySummary {
  date: LocalDate;
  entryCount: number;
  totals: Macros;
  targets: Targets;
}

/** One summary per calendar day from `from` to `to` inclusive, including days with no entries. */
export function dailySeries(
  entries: readonly LogEntry[],
  history: readonly TargetPeriod[],
  from: LocalDate,
  to: LocalDate,
): DaySummary[] {
  const byDate = new Map<LocalDate, LogEntry[]>();
  for (const e of entries) {
    const list = byDate.get(e.date);
    if (list) list.push(e);
    else byDate.set(e.date, [e]);
  }
  const days: DaySummary[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const list = byDate.get(date) ?? [];
    days.push({
      date,
      entryCount: list.length,
      totals: list.length ? sumMacros(list.map((e) => e.macros)) : { ...ZERO_MACROS },
      targets: targetsForDate(history, date),
    });
  }
  return days;
}

/** A day counts as on target when calories are within this fraction of the calorie target. */
export const ON_TARGET_TOLERANCE = 0.1;

export function isOnTarget(day: DaySummary, tolerance = ON_TARGET_TOLERANCE): boolean {
  const target = day.targets.calories;
  return target > 0 && Math.abs(day.totals.calories - target) / target <= tolerance;
}

export interface PeriodSummary {
  /** Days included in averages: something logged, and not `today` (still in progress). */
  daysCounted: number;
  average: Macros;
  /** Average target per macro; only set when every counted day had that target. */
  averageTargets: Partial<Macros>;
  daysOnTarget: number;
}

export function summarizePeriod(days: readonly DaySummary[], today: LocalDate): PeriodSummary {
  const counted = days.filter((d) => d.entryCount > 0 && d.date !== today);
  const n = counted.length;
  const total = sumMacros(counted.map((d) => d.totals));
  const average: Macros = n
    ? {
        calories: total.calories / n,
        protein: total.protein / n,
        carbs: total.carbs / n,
        fat: total.fat / n,
      }
    : { ...ZERO_MACROS };

  const averageTargets: Partial<Macros> = {};
  for (const key of ['calories', 'protein', 'carbs', 'fat'] as const) {
    const values = counted
      .map((d) => d.targets[key])
      .filter((v): v is number => v !== undefined && v > 0);
    if (n > 0 && values.length === n) averageTargets[key] = values.reduce((a, b) => a + b, 0) / n;
  }

  return {
    daysCounted: n,
    average,
    averageTargets,
    daysOnTarget: counted.filter((d) => isOnTarget(d)).length,
  };
}
