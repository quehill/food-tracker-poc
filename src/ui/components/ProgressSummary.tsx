import type { CSSProperties } from 'react';
import { macroCalorieShares, type CalorieShares } from '../../domain/macros';
import { computeProgress, type MacroProgress } from '../../domain/targets';
import type { Macros, Targets } from '../../domain/types';
import { fmtGrams, fmtKcal } from '../format';
import { fmtPercent, MACRO_META, SPLIT_KEYS } from '../macroMeta';
import { Ring, type RingSegment } from './Ring';

/** Outer track: calories vs target. Inner track: the day's calories split by macro. */
function CalorieRing({ p, shares }: { p: MacroProgress; shares: CalorieShares | null }) {
  const fraction = p.fraction ?? 0;
  const remaining = p.remaining ?? 0;
  const over = remaining < 0;
  const calorieSegments: RingSegment[] = [{ value: Math.min(fraction, 1), color: 'var(--accent)' }];
  // Past 100% the overflow laps the ring again in the warning color.
  if (fraction > 1)
    calorieSegments.push({ value: Math.min(fraction - 1, 1), color: 'var(--danger)' });

  const split = shares
    ? 'Split: ' + SPLIT_KEYS.map((k) => `${MACRO_META[k].name} ${fmtPercent(shares[k])}`).join(', ')
    : 'Nothing logged';
  const label =
    p.target === undefined
      ? `Calories: ${fmtKcal(p.consumed)} kcal. ${split}.`
      : `Calories: ${fmtKcal(p.consumed)} of ${fmtKcal(p.target)} kcal, ` +
        `${over ? `${fmtKcal(-remaining)} over` : `${fmtKcal(remaining)} left`}. ${split}.`;

  return (
    <Ring
      size={124}
      label={label}
      tracks={[
        {
          thickness: 12,
          segments: p.target === undefined ? [] : calorieSegments,
          stacked: false,
          roundCaps: true,
        },
        {
          thickness: 6,
          gap: 0.015,
          segments: shares
            ? SPLIT_KEYS.map((k) => ({ value: shares[k], color: MACRO_META[k].color }))
            : [],
        },
      ]}
    >
      <span className={`ring-big${over ? ' over' : ''}`}>
        {fmtKcal(p.target === undefined ? p.consumed : Math.abs(remaining))}
      </span>
      <span className="ring-small">
        {p.target === undefined ? 'kcal' : over ? 'kcal over' : 'kcal left'}
      </span>
    </Ring>
  );
}

function MacroRow({ p, share }: { p: MacroProgress; share: number | undefined }) {
  const { name, color } = MACRO_META[p.key];
  const over = p.remaining !== undefined && p.remaining < 0;
  const notes = [
    p.remaining !== undefined &&
      (over ? `${fmtGrams(-p.remaining)} g over` : `${fmtGrams(p.remaining)} g left`),
    share !== undefined && `${fmtPercent(share)} of kcal`,
  ].filter(Boolean);
  return (
    <div className="macro-row">
      <div className="macro-row-head">
        <span className="macro-row-name">
          <span className="dot" style={{ background: color }} />
          {name}
        </span>
        <span className="macro-row-value">
          {fmtGrams(p.consumed)}
          <span className="muted">
            {p.target !== undefined ? ` / ${fmtGrams(p.target)} g` : ' g'}
          </span>
        </span>
      </div>
      {p.fraction !== undefined && (
        <div
          className={`bar${over ? ' over' : ''}`}
          role="progressbar"
          aria-label={`${name} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(p.fraction, 1) * 100)}
          style={{ '--bar-color': color } as CSSProperties}
        >
          <span style={{ width: `${Math.min(p.fraction, 1) * 100}%` }} />
        </div>
      )}
      {notes.length > 0 && (
        <div className={`macro-row-note${over ? ' over' : ''}`}>{notes.join(' · ')}</div>
      )}
    </div>
  );
}

/** Compact daily summary sized to leave most of the screen for the entry list. */
export function ProgressSummary({ totals, targets }: { totals: Macros; targets: Targets }) {
  const p = computeProgress(totals, targets);
  const shares = macroCalorieShares(totals);
  return (
    <section className="card today-summary" aria-label="Daily totals">
      <div className="today-summary-ring">
        <CalorieRing p={p.calories} shares={shares} />
        {p.calories.target !== undefined && (
          <div className="today-summary-kcal">
            {fmtKcal(p.calories.consumed)} / {fmtKcal(p.calories.target)} kcal
          </div>
        )}
      </div>
      <div className="macro-rows">
        {SPLIT_KEYS.map((k) => (
          <MacroRow key={k} p={p[k]} share={shares?.[k]} />
        ))}
      </div>
    </section>
  );
}
