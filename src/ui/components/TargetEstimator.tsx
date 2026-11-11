import { useId, useState } from 'react';
import {
  ACTIVITY_LEVELS,
  estimateTargets,
  GOALS,
  validateProfile,
  type ActivityLevel,
  type Goal,
  type Profile,
  type Sex,
} from '../../domain/energy';
import { parseDecimal } from '../../domain/quantity';
import type { Targets } from '../../domain/types';
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from '../../domain/units';
import { fmtKcal } from '../format';

interface Draft {
  sex: Sex;
  age: string;
  feet: string;
  inches: string;
  pounds: string;
  activity: ActivityLevel;
  goal: Goal;
}

function toDraft(p: Profile | undefined): Draft {
  if (!p) {
    return {
      sex: 'female',
      age: '',
      feet: '',
      inches: '',
      pounds: '',
      activity: 'light',
      goal: 'maintain',
    };
  }
  const { feet, inches } = cmToFeetInches(p.heightCm);
  return {
    sex: p.sex,
    age: String(p.age),
    feet: String(feet),
    inches: String(inches),
    pounds: String(Math.round(kgToLb(p.weightKg))),
    activity: p.activity,
    goal: p.goal,
  };
}

function toProfile(d: Draft): { profile: Profile; inchesError?: string } {
  const inches = d.inches.trim() ? parseDecimal(d.inches) : 0;
  const inchesOk = Number.isFinite(inches) && inches >= 0 && inches < 12;
  return {
    profile: {
      sex: d.sex,
      age: parseDecimal(d.age),
      heightCm: inchesOk ? feetInchesToCm(parseDecimal(d.feet), inches) : NaN,
      weightKg: lbToKg(parseDecimal(d.pounds)),
      activity: d.activity,
      goal: d.goal,
    },
    inchesError: inchesOk ? undefined : 'Inches must be 0 to 11',
  };
}

const kcal = (v: number) => `${fmtKcal(v)} kcal`;
const signedKcal = (v: number) => (v < 0 ? `−${kcal(-v)}` : `+${kcal(v)}`);

interface TargetEstimatorProps {
  initial: Profile | undefined;
  onUse: (profile: Profile, targets: Targets) => void;
  onCancel: () => void;
}

/** Body measurements in, suggested targets out, with each step of the calculation shown. */
export function TargetEstimator({ initial, onUse, onCancel }: TargetEstimatorProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [showErrors, setShowErrors] = useState(false);
  const bodyErrorId = useId();
  const heightErrorId = useId();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const { profile, inchesError } = toProfile(draft);
  const validation = validateProfile(profile);
  const errors = validation.ok ? {} : validation.errors;
  const heightError = inchesError ?? errors.heightCm;
  const valid = validation.ok && !inchesError;
  const estimate = valid ? estimateTargets(profile) : undefined;

  const numberField = (
    key: 'age' | 'feet' | 'inches' | 'pounds',
    label: string,
    error: string | undefined,
    errorId: string,
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode={key === 'age' || key === 'feet' ? 'numeric' : 'decimal'}
        autoComplete="off"
        value={draft[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={showErrors && error ? true : undefined}
        aria-describedby={showErrors && error ? errorId : undefined}
      />
    </label>
  );

  return (
    <form
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (estimate) onUse(profile, estimate.targets);
        else setShowErrors(true);
      }}
    >
      <fieldset className="segmented-field">
        <legend>Sex</legend>
        <div className="segmented">
          {(['female', 'male'] as const).map((s) => (
            <label key={s} className={draft.sex === s ? 'active' : ''}>
              <input
                type="radio"
                name="sex"
                value={s}
                checked={draft.sex === s}
                onChange={() => set('sex', s)}
              />
              {s === 'female' ? 'Female' : 'Male'}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field-grid">
        {numberField('age', 'Age (years)', errors.age, bodyErrorId)}
        {numberField('pounds', 'Weight (lb)', errors.weightKg, bodyErrorId)}
      </div>
      {showErrors && (errors.age || errors.weightKg) && (
        <p id={bodyErrorId} className="field-error" role="alert">
          {[errors.age, errors.weightKg].filter(Boolean).join('. ')}
        </p>
      )}
      <div className="field-grid">
        {numberField('feet', 'Height (ft)', heightError, heightErrorId)}
        {numberField('inches', 'Height (in)', heightError, heightErrorId)}
      </div>
      {showErrors && heightError && (
        <p id={heightErrorId} className="field-error" role="alert">
          {heightError}
        </p>
      )}

      <label className="field">
        <span>Activity level</span>
        <select
          value={draft.activity}
          onChange={(e) => set('activity', e.target.value as ActivityLevel)}
        >
          {Object.entries(ACTIVITY_LEVELS).map(([key, a]) => (
            <option key={key} value={key}>
              {a.label}: {a.description}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Goal</span>
        <select value={draft.goal} onChange={(e) => set('goal', e.target.value as Goal)}>
          {Object.entries(GOALS).map(([key, g]) => (
            <option key={key} value={key}>
              {g.label}
            </option>
          ))}
        </select>
      </label>

      {estimate ? (
        <div className="estimate" aria-live="polite">
          <dl className="estimate-steps">
            <dt>Resting burn (BMR)</dt>
            <dd>{kcal(estimate.bmr)}</dd>
            <dt>× {ACTIVITY_LEVELS[profile.activity].factor} activity = maintenance</dt>
            <dd>{kcal(estimate.tdee)}</dd>
            {estimate.goalAdjustment !== 0 && (
              <>
                <dt>Goal ({GOALS[profile.goal].label.toLowerCase()})</dt>
                <dd>{signedKcal(estimate.goalAdjustment)}</dd>
              </>
            )}
            <dt className="estimate-total">Daily calories</dt>
            <dd className="estimate-total">{kcal(estimate.targets.calories)}</dd>
            <dt>
              Protein: {estimate.proteinPerKg.toFixed(1)} g/kg
              {estimate.referenceWeightKg < profile.weightKg
                ? ` of a reference weight (${Math.round(kgToLb(estimate.referenceWeightKg))} lb, BMI 25)`
                : ` of body weight (${Math.round(profile.weightKg)} kg)`}
            </dt>
            <dd>{estimate.targets.protein} g</dd>
            <dt>
              {estimate.fatBasis === 'share'
                ? 'Fat: 30% of calories'
                : 'Fat: minimum of 0.6 g/kg (more than 30% of calories)'}
            </dt>
            <dd>{estimate.targets.fat} g</dd>
            <dt>Carbs: the remaining calories</dt>
            <dd>{estimate.targets.carbs} g</dd>
          </dl>
          {estimate.floorApplied && (
            <p className="notice">
              The goal works out to {kcal(estimate.goalCalories)}, below the commonly advised
              minimum of {kcal(estimate.targets.calories)} without medical supervision, so the
              minimum is used. A slower goal may suit you better.
            </p>
          )}
        </div>
      ) : (
        <p className="small muted">Fill in age, height and weight to see your estimate.</p>
      )}

      <details className="small muted">
        <summary>How is this calculated?</summary>
        <p>
          Resting burn uses the Mifflin-St Jeor equation (1990), which a 2005 review by the American
          Dietetic Association found the most reliable common formula, usually within 10% of
          measured values. It&apos;s multiplied by a standard activity factor. Losing or gaining
          about ½ lb a week takes roughly 250 kcal a day (about 3,500 kcal per pound).
        </p>
        <p>
          Protein is 1.6 g per kg of body weight, the level above which a 2018 meta-analysis found
          no extra muscle gain, and 2.0 g/kg while losing weight to help keep muscle. With a BMI of
          30 or more, the weight at BMI 25 is used instead. Fat is 30% of calories (recommended
          range 20–35%) and carbs make up the rest.
        </p>
        <p>
          These are estimates, not medical advice. Check your weight trend after 2–3 weeks and
          adjust. Talk to a professional if you&apos;re pregnant, breastfeeding or managing a health
          condition.
        </p>
      </details>

      <div className="button-row">
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button primary">
          Use these targets
        </button>
      </div>
    </form>
  );
}
