import { useState, type FormEvent } from 'react';
import { repos } from '../../app/repos';
import { loadSampleData } from '../../data/sampleData';
import { parseDecimal } from '../../domain/quantity';
import { validateTargets } from '../../domain/targets';
import type { Targets } from '../../domain/types';
import { toInputValue } from '../format';
import { useRepoQuery } from '../hooks/useRepoQuery';

type TargetKey = keyof Targets;

function TargetsForm({ initial }: { initial: Targets }) {
  const [text, setText] = useState<Record<TargetKey, string>>({
    calories: toInputValue(initial.calories),
    protein: toInputValue(initial.protein),
    carbs: toInputValue(initial.carbs),
    fat: toInputValue(initial.fat),
  });
  const [errors, setErrors] = useState<Partial<Record<TargetKey, string>>>({});
  const [status, setStatus] = useState('');

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
    await repos.settings.setTargets(targets);
    setStatus('Saved');
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
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
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
  );
}

export function SettingsScreen() {
  const targets = useRepoQuery(() => repos.settings.getTargets(), []);
  const [sampleStatus, setSampleStatus] = useState('');

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
        {targets && <TargetsForm initial={targets} />}
      </section>

      <section className="card">
        <h2>Data</h2>
        <p className="small muted">
          Data is stored only on this device. Backup export/import and CSV export are coming in a
          later phase.
        </p>
      </section>

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
