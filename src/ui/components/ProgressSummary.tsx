import type { MacroProgress } from '../../domain/targets';
import type { MacroKey, Macros, Targets } from '../../domain/types';
import { computeProgress } from '../../domain/targets';
import { fmtGrams, fmtKcal } from '../format';

const NAMES: Record<MacroKey, string> = {
  calories: 'Calories',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
};

function Metric({ p }: { p: MacroProgress }) {
  const fmt = p.key === 'calories' ? fmtKcal : fmtGrams;
  const unit = p.key === 'calories' ? ' kcal' : ' g';
  const over = p.remaining !== undefined && p.remaining < 0;
  return (
    <div>
      <div className="metric-name">{NAMES[p.key]}</div>
      <div className="metric-value">
        {fmt(p.consumed)}
        {p.target !== undefined && (
          <span className="muted">
            {' '}
            / {fmt(p.target)}
            {unit}
          </span>
        )}
        {p.target === undefined && <span className="muted">{unit}</span>}
      </div>
      {p.remaining !== undefined && (
        <div className={`metric-remaining${over ? ' over' : ''}`}>
          {over ? `${fmt(-p.remaining)} over` : `${fmt(p.remaining)} left`}
        </div>
      )}
      {p.fraction !== undefined && (
        <div
          className={`bar${over ? ' over' : ''}`}
          role="progressbar"
          aria-label={`${NAMES[p.key]} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(p.fraction, 1) * 100)}
        >
          <span style={{ width: `${Math.min(p.fraction, 1) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

export function ProgressSummary({ totals, targets }: { totals: Macros; targets: Targets }) {
  const p = computeProgress(totals, targets);
  return (
    <section className="card progress" aria-label="Daily totals">
      <div className="progress-primary">
        <Metric p={p.calories} />
        <Metric p={p.protein} />
      </div>
      <div className="progress-secondary">
        <Metric p={p.carbs} />
        <Metric p={p.fat} />
      </div>
    </section>
  );
}
