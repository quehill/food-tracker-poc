import { useSearchParams } from 'react-router-dom';
import { repos } from '../../app/repos';
import { addDays, isValidLocalDate, toLocalDate } from '../../domain/dates';
import { dailySeries, ON_TARGET_TOLERANCE, summarizePeriod } from '../../domain/trends';
import type { MacroKey } from '../../domain/types';
import { TrendChart } from '../components/TrendChart';
import { fmtGrams, fmtKcal, fmtShortDate } from '../format';
import { MACRO_META, SPLIT_KEYS } from '../macroMeta';
import { useRepoQuery } from '../hooks/useRepoQuery';

const DAYS = 7;

function Difference({ actual, target, unit }: { actual: number; target: number; unit: string }) {
  const fmt = unit === 'kcal' ? fmtKcal : fmtGrams;
  const diff = actual - target;
  if (Math.abs(diff) < 0.5) return <span className="muted">on target</span>;
  return (
    <span className="muted">
      {fmt(Math.abs(diff))} {unit} {diff > 0 ? 'over' : 'under'}
    </span>
  );
}

export function TrendsScreen() {
  const [params, setParams] = useSearchParams();
  const today = toLocalDate(new Date());
  const endParam = params.get('end');
  const end = endParam && isValidLocalDate(endParam) && endParam < today ? endParam : today;
  const from = addDays(end, -(DAYS - 1));
  const setEnd = (d: string) => setParams(d >= today ? {} : { end: d }, { replace: true });

  const entries = useRepoQuery(() => repos.log.listByDateRange(from, end), [from, end]);
  const history = useRepoQuery(() => repos.settings.getTargetHistory(), []);

  const days = entries && history ? dailySeries(entries, history, from, end) : undefined;
  const summary = days && summarizePeriod(days, today);

  const avgRow = (key: MacroKey) => {
    if (!summary) return null;
    const actual = summary.average[key];
    const target = summary.averageTargets[key];
    const unit = key === 'calories' ? 'kcal' : 'g';
    const fmt = key === 'calories' ? fmtKcal : fmtGrams;
    return (
      <div key={key} className={`summary-row${key === 'calories' ? ' primary' : ''}`}>
        <span className="macro-row-name">
          {key !== 'calories' && (
            <span className="dot" style={{ background: MACRO_META[key].color }} />
          )}
          {MACRO_META[key].name}
        </span>
        <span className="summary-value">
          {fmt(actual)}
          <span className="muted">
            {target !== undefined ? ` / ${fmt(target)} ${unit}` : ` ${unit}`}
          </span>
        </span>
        {target !== undefined && <Difference actual={actual} target={target} unit={unit} />}
      </div>
    );
  };

  return (
    <section className="screen">
      <h1 className="visually-hidden">Trends</h1>
      <div className="date-switcher">
        <button
          type="button"
          className="icon-button"
          aria-label="Previous week"
          onClick={() => setEnd(addDays(end, -DAYS))}
        >
          ‹
        </button>
        <div className="date-switcher-label" aria-live="polite">
          {end === today ? 'Last 7 days' : `${fmtShortDate(from)} – ${fmtShortDate(end)}`}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Next week"
          disabled={end >= today}
          onClick={() => setEnd(addDays(end, DAYS))}
        >
          ›
        </button>
      </div>

      {days && (
        <section className="card stack" aria-labelledby="trend-chart-title">
          <h2 id="trend-chart-title">Calories vs target</h2>
          <TrendChart days={days} today={today} />
          <ul className="legend legend-inline" aria-hidden="true">
            {SPLIT_KEYS.map((k) => (
              <li key={k}>
                <span className="dot" style={{ background: MACRO_META[k].color }} />
                {MACRO_META[k].name}
              </li>
            ))}
            <li>
              <span className="legend-target" />
              Target
            </li>
          </ul>
        </section>
      )}

      {summary && (
        <section className="card stack" aria-labelledby="trend-summary-title">
          <h2 id="trend-summary-title">Daily average</h2>
          {summary.daysCounted === 0 ? (
            <p className="muted">
              No completed days with entries in this period. Averages leave out today and days with
              nothing logged.
            </p>
          ) : (
            <>
              {avgRow('calories')}
              {SPLIT_KEYS.map(avgRow)}
              <div className="summary-row">
                <span className="macro-row-name">
                  On calorie target (±{Math.round(ON_TARGET_TOLERANCE * 100)}%)
                </span>
                <span className="summary-value">
                  {summary.daysOnTarget}
                  <span className="muted"> of {summary.daysCounted} days</span>
                </span>
              </div>
            </>
          )}
        </section>
      )}

      <details className="small muted">
        <summary>How are these numbers calculated?</summary>
        <p>
          Each bar is the calories logged that day, split by where they came from: protein and carbs
          at 4 kcal/g, fat at 9 kcal/g (scaled so the bar matches the logged calories). The dashed
          line is the calorie target that was in effect that day; changing your targets doesn&apos;t
          change past days. Averages cover days with at least one entry and leave out today because
          it isn&apos;t finished. A day is on target when calories are within ±
          {Math.round(ON_TARGET_TOLERANCE * 100)}% of the target. Tap a bar to open that day.
        </p>
      </details>
    </section>
  );
}
