import { useState, type FormEvent } from 'react';
import { validateFoodDraft, type FoodDraft, type FoodDraftField } from '../../domain/food';
import { checkCalories } from '../../domain/macros';
import { parseDecimal } from '../../domain/quantity';
import { fmtKcal, toInputValue } from '../format';

interface FoodFormProps {
  initial?: FoodDraft;
  caloriesEstimated?: boolean;
  submitLabel: string;
  onSubmit: (draft: FoodDraft) => void;
}

type Text = Record<
  'name' | 'brand' | 'servingLabel' | 'servingGrams' | 'calories' | 'protein' | 'carbs' | 'fat',
  string
>;

function toText(d?: FoodDraft): Text {
  return {
    name: d?.name ?? '',
    brand: d?.brand ?? '',
    servingLabel: d?.servingLabel ?? '',
    servingGrams: toInputValue(d?.servingGrams),
    calories: toInputValue(d?.macros.calories),
    protein: toInputValue(d?.macros.protein),
    carbs: toInputValue(d?.macros.carbs),
    fat: toInputValue(d?.macros.fat),
  };
}

function toDraft(t: Text, favorite: boolean): FoodDraft {
  return {
    name: t.name,
    brand: t.brand,
    servingLabel: t.servingLabel,
    servingGrams: t.servingGrams.trim() ? parseDecimal(t.servingGrams) : undefined,
    macros: {
      calories: parseDecimal(t.calories),
      protein: parseDecimal(t.protein),
      carbs: parseDecimal(t.carbs),
      fat: parseDecimal(t.fat),
    },
    favorite,
  };
}

export function FoodForm({ initial, caloriesEstimated, submitLabel, onSubmit }: FoodFormProps) {
  const [text, setText] = useState<Text>(() => toText(initial));
  const [favorite, setFavorite] = useState(initial?.favorite ?? false);
  const [errors, setErrors] = useState<Partial<Record<FoodDraftField, string>>>({});

  const draft = toDraft(text, favorite);
  const macrosValid = Object.values(draft.macros).every((v) => Number.isFinite(v) && v >= 0);
  const calorieCheck = macrosValid ? checkCalories(draft.macros) : null;

  const set = (key: keyof Text) => (e: { target: { value: string } }) =>
    setText((t) => ({ ...t, [key]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateFoodDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(draft);
  };

  const field = (
    key: keyof Text,
    label: string,
    opts: { numeric?: boolean; required?: boolean; placeholder?: string } = {},
  ) => {
    const error = errors[key as FoodDraftField];
    return (
      <label className="field">
        <span>
          {label}
          {opts.required ? '' : ' (optional)'}
        </span>
        <input
          value={text[key]}
          onChange={set(key)}
          inputMode={opts.numeric ? 'decimal' : undefined}
          autoComplete="off"
          placeholder={opts.placeholder}
          aria-invalid={error ? true : undefined}
        />
        {error && <span className="field-error">{error}</span>}
      </label>
    );
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {field('name', 'Name', { required: true })}
      {field('brand', 'Brand')}
      <div className="field-grid">
        {field('servingLabel', 'Serving', { required: true, placeholder: '1 slice' })}
        {field('servingGrams', 'Serving grams', { numeric: true, placeholder: '28' })}
      </div>
      <p className="small muted">Macros below are for one serving.</p>
      <div className="field-grid">
        {field('calories', 'Calories (kcal)', { numeric: true, required: true })}
        {field('protein', 'Protein (g)', { numeric: true, required: true })}
        {field('carbs', 'Carbs (g)', { numeric: true, required: true })}
        {field('fat', 'Fat (g)', { numeric: true, required: true })}
      </div>

      {caloriesEstimated && (
        <p className="notice">
          Calories were estimated from macros (4 × protein + 4 × carbs + 9 × fat). Edit if you have
          the label value.
        </p>
      )}

      {calorieCheck?.mismatch && (
        <div className="notice" role="status">
          <p style={{ margin: 0 }}>
            Calories ({fmtKcal(calorieCheck.entered)}) differ from 4 × protein + 4 × carbs + 9 × fat
            = {fmtKcal(calorieCheck.expected)} kcal by {Math.round(calorieCheck.difference * 100)}%.
            Check the label; you can still save.
          </p>
          <button
            type="button"
            className="button"
            style={{ marginTop: 8 }}
            onClick={() =>
              setText((t) => ({ ...t, calories: String(Math.round(calorieCheck.expected)) }))
            }
          >
            Use {fmtKcal(calorieCheck.expected)} kcal
          </button>
        </div>
      )}

      <label className="checkbox">
        <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        Favorite
      </label>

      <button type="submit" className="button primary block">
        {submitLabel}
      </button>
    </form>
  );
}
