import { useState, type FormEvent } from 'react';
import { repos } from '../../app/repos';
import { loadSampleData } from '../../data/sampleData';
import { DataSection } from '../components/DataSection';
import { Sheet } from '../components/Sheet';
import { TargetEstimator } from '../components/TargetEstimator';
import { toLocalDate } from '../../domain/dates';
import type { Profile } from '../../domain/energy';
import { parseDecimal } from '../../domain/quantity';
import { validateTargets } from '../../domain/targets';
import type { Targets } from '../../domain/types';
import { toInputValue } from '../format';
import { useRepoQuery } from '../hooks/useRepoQuery';

type TargetKey = keyof Targets;

interface TargetsFormProps {
  initial: Targets;
  /** Lives in the parent so it survives the remount that follows a save. */
  status: string;
  setStatus: (s: string) => void;
}

function TargetsForm({ initial, status, setStatus }: TargetsFormProps) {
  const [text, setText] = useState<Record<TargetKey, string>>({
    calories: toInputValue(initial.calories),
    protein: toInputValue(initial.protein),
    carbs: toInputValue(initial.carbs),
    fat: toInputValue(initial.fat),
  });
  const [errors, setErrors] = useState<Partial<Record<TargetKey, string>>>({});
  const [estimating, setEstimating] = useState(false);
  const profile = useRepoQuery(() => repos.settings.getProfile(), []);

  const applyEstimate = async (p: Profile, t: Targets) => {
    await repos.settings.setProfile(p);
    setText({
      calories: toInputValue(t.calories),
      protein: toInputValue(t.protein),
      carbs: toInputValue(t.carbs),
      fat: toInputValue(t.fat),
    });
    setErrors({});
    setEstimating(false);
    setStatus('Filled in from your estimate. Review, then tap Save targets.');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const optional = (s: string) => (s.trim() ? parseDecimal(s) : undefined);
    const targets: Targets = {
      calories: parseDecimal(text.calories),
      protein: parseDecimal(text.protein),
      carbs: optional(text.carbs),
      fat: optional(text.fat),
    };
    const result = validateTargets(targets);
    if (!result.ok) {
      setErrors(result.errors);
      setStatus('');
      return;
    }
    setErrors({});
    await repos.settings.setTargets(targets, toLocalDate(new Date()));
    setStatus('Saved. New targets apply from today; past days keep theirs.');
  };

  const field = (key: TargetKey, label: string, required: boolean) => (
    <label className="field">
      <span>
        {label}
        {required ? '' : ' (optional)'}
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        value={text[key]}
        onChange={(e) => {
          setText((t) => ({ ...t, [key]: e.target.value }));
          setStatus('');
        }}
        aria-invalid={errors[key] ? true : undefined}
      />
      {errors[key] && <span className="field-error">{errors[key]}</span>}
    </label>
  );

  return (
    <>
      <form className="form" onSubmit={(e) => void submit(e)} noValidate>
        <button type="button" className="button block" onClick={() => setEstimating(true)}>
          Estimate my targets
        </button>
        <div className="field-grid">
          {field('calories', 'Calories (kcal)', true)}
          {field('protein', 'Protein (g)', true)}
          {field('carbs', 'Carbs (g)', false)}
          {field('fat', 'Fat (g)', false)}
        </div>
        <button type="submit" className="button primary block">
          Save targets
        </button>
        <p className="small muted" role="status" aria-live="polite">
          {status}
        </p>
      </form>
      <Sheet open={estimating} title="Estimate my targets" onClose={() => setEstimating(false)}>
        <TargetEstimator
          initial={profile}
          onCancel={() => setEstimating(false)}
          onUse={(p, t) => void applyEstimate(p, t)}
        />
      </Sheet>
    </>
  );
}

export function SettingsScreen() {
  const targets = useRepoQuery(() => repos.settings.getTargets(), []);
  const [sampleStatus, setSampleStatus] = useState('');
  const [targetsStatus, setTargetsStatus] = useState('');

  const loadSamples = async () => {
    const added = await loadSampleData(repos, Date.now());
    setSampleStatus(
      added.foods || added.meals
        ? `Added ${added.foods} sample foods and ${added.meals} sample meal.`
        : 'Sample data is already loaded.',
    );
  };

  return (
    <section className="screen">
      <h1>Settings</h1>

      <section className="card">
        <h2>Daily targets</h2>
        {targets && (
          <TargetsForm
            key={JSON.stringify(targets)}
            initial={targets}
            status={targetsStatus}
            setStatus={setTargetsStatus}
          />
        )}
      </section>

      <DataSection />

      <details className="card">
        <summary>Developer</summary>
        <button type="button" className="button block" onClick={() => void loadSamples()}>
          Load sample data
        </button>
        <p className="small muted" role="status" aria-live="polite">
          {sampleStatus}
        </p>
      </details>

      <p className="small muted">Version {__APP_VERSION__}</p>
    </section>
  );
}
