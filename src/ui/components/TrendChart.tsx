import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { macroCalorieShares } from '../../domain/macros';
import { ON_TARGET_TOLERANCE, type DaySummary } from '../../domain/trends';
import type { LocalDate } from '../../domain/types';
import { fmtGrams, fmtKcal, fmtLongDate, fmtWeekday } from '../format';
import { MACRO_META, SPLIT_KEYS } from '../macroMeta';

const KCAL_STEP = 500;

/** Rounds the axis top up to the next 500 kcal, with a little headroom. */
function axisMax(days: readonly DaySummary[]): number {
  const peak = Math.max(...days.flatMap((d) => [d.totals.calories, d.targets.calories]), 0);
  return Math.max(KCAL_STEP, Math.ceil((peak * 1.05) / KCAL_STEP) * KCAL_STEP);
}

function dayLabel(day: DaySummary, today: LocalDate): string {
  const when = fmtLongDate(day.date) + (day.date === today ? ' (today, in progress)' : '');
  if (day.entryCount === 0)
    return `${when}: nothing logged. Target ${fmtKcal(day.targets.calories)} kcal.`;
  const { calories, protein, carbs, fat } = day.totals;
  return (
    `${when}: ${fmtKcal(calories)} of ${fmtKcal(day.targets.calories)} kcal. ` +
    `Protein ${fmtGrams(protein)} g, carbs ${fmtGrams(carbs)} g, fat ${fmtGrams(fat)} g.`
  );
}

/**
 * Stacked calorie bars per day, split by macro, with each day's calorie target as a dashed
 * marker. Each column links to that day on Today.
 */
export function TrendChart({ days, today }: { days: readonly DaySummary[]; today: LocalDate }) {
  const max = axisMax(days);
  const pct = (kcal: number) => `${Math.min(kcal / max, 1) * 100}%`;

  return (
    <div className="trend-chart">
      <div className="trend-grid" aria-hidden="true">
        {[1, 0.5].map((f) => (
          <div key={f} className="trend-gridline" style={{ bottom: `${f * 100}%` }}>
            <span>{fmtKcal(max * f)}</span>
          </div>
        ))}
      </div>
      <ol className="trend-cols">
        {days.map((day) => {
          const { calories } = day.totals;
          const target = day.targets.calories;
          const shares = macroCalorieShares(day.totals);
          const over = target > 0 && calories > target * (1 + ON_TARGET_TOLERANCE);
          const inProgress = day.date === today;
          return (
            <li key={day.date}>
              <Link
                to={inProgress ? '/' : `/?date=${day.date}`}
                className={`trend-col${inProgress ? ' in-progress' : ''}`}
                aria-label={dayLabel(day, today)}
              >
                <span className={`trend-value${over ? ' over' : ''}`}>
                  {day.entryCount ? fmtKcal(calories) : '—'}
                </span>
                <span className="trend-plot">
                  <span className="trend-stack" style={{ height: pct(calories) }}>
                    {shares ? (
                      SPLIT_KEYS.map((k) => (
                        <span
                          key={k}
                          style={{ flexGrow: shares[k], background: MACRO_META[k].color }}
                        />
                      ))
                    ) : (
                      <span style={{ flexGrow: 1, background: 'var(--muted)' }} />
                    )}
                  </span>
                  {target > 0 && (
                    <span
                      className="trend-target"
                      style={{ '--target': pct(target) } as CSSProperties}
                    />
                  )}
                </span>
                <span className="trend-day">
                  {inProgress ? 'Today' : fmtWeekday(day.date)}
                  <span className="muted">{Number(day.date.slice(8))}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
