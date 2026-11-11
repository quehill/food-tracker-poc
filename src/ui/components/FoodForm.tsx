import { useId, useState, type FormEvent } from 'react';
import { validateFoodDraft, type FoodDraft, type FoodDraftField } from '../../domain/food';
import { checkCalories, MACRO_KEYS, scaleMacros } from '../../domain/macros';
import { parseDecimal } from '../../domain/quantity';
import type { MacroKey, Macros } from '../../domain/types';
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

function toDraft(t: Text, favorite: boolean, exact: Partial<Macros>): FoodDraft {
  // Use the unrounded value when the field still shows it, so stored values aren't rounded.
  const macro = (key: MacroKey) => {
    const x = exact[key];
    return x !== undefined && toInputValue(x) === t[key] ? x : parseDecimal(t[key]);
  };
  return {
    name: t.name,
    brand: t.brand,
    servingLabel: t.servingLabel,
    servingGrams: t.servingGrams.trim() ? parseDecimal(t.servingGrams) : undefined,
    macros: {
      calories: macro('calories'),
      protein: macro('protein'),
      carbs: macro('carbs'),
      fat: macro('fat'),
    },
    favorite,
  };
}

const GRAMS_LABEL = /^\d+(\.\d+)?\s*g$/i;

function validGrams(g: number | undefined): g is number {
  return g !== undefined && Number.isFinite(g) && g > 0;
}

function validMacros(m: Macros): boolean {
  return MACRO_KEYS.every((k) => Number.isFinite(m[k]) && m[k] >= 0);
}

/** Macros at a known serving weight; changing serving grams rescales from this. */
interface ScaleBase {
  grams?: number;
  macros: Macros;
}

export function FoodForm({ initial, caloriesEstimated, submitLabel, onSubmit }: FoodFormProps) {
  const [text, setText] = useState<Text>(() => toText(initial));
  const [exact, setExact] = useState<Partial<Macros>>(() => ({ ...initial?.macros }));
  const [base, setBase] = useState<ScaleBase | null>(() =>
    initial ? { grams: initial.servingGrams, macros: { ...initial.macros } } : null,
  );
  const [autoScale, setAutoScale] = useState(true);
  const [favorite, setFavorite] = useState(initial?.favorite ?? false);
  const [errors, setErrors] = useState<Partial<Record<FoodDraftField, string>>>({});
  const formId = useId();

  const draft = toDraft(text, favorite, exact);
  const macrosValid = validMacros(draft.macros);
  const calorieCheck = macrosValid ? checkCalories(draft.macros) : null;
  const canScale = autoScale && validGrams(base?.grams) && !!base && validMacros(base.macros);

  const set = (key: keyof Text) => (e: { target: { value: string } }) =>
    setText((t) => ({ ...t, [key]: e.target.value }));

  /** A manual macro edit makes the current values the new scaling base. */
  const setMacro = (key: MacroKey, value: string) => {
    const nextText = { ...text, [key]: value };
    const nextExact = { ...exact, [key]: undefined };
    const grams = parseDecimal(nextText.servingGrams);
    setText(nextText);
    setExact(nextExact);
    setBase({
      grams: validGrams(grams) ? grams : undefined,
      macros: toDraft(nextText, favorite, nextExact).macros,
    });
  };

  const setServingGrams = (value: string) => {
    const grams = parseDecimal(value);
    if (!canScale || !base?.grams || !validGrams(grams)) {
      setText((t) => ({ ...t, servingGrams: value }));
      return;
    }
    const scaled = scaleMacros(base.macros, grams / base.grams);
    setExact(scaled);
    setText((t) => ({
      ...t,
      servingGrams: value,
      calories: toInputValue(scaled.calories),
      protein: toInputValue(scaled.protein),
      carbs: toInputValue(scaled.carbs),
      fat: toInputValue(scaled.fat),
      servingLabel: GRAMS_LABEL.test(t.servingLabel.trim())
        ? `${toInputValue(grams)} g`
        : t.servingLabel,
    }));
  };

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
    const onChange =
      key === 'servingGrams'
        ? (e: { target: { value: string } }) => setServingGrams(e.target.value)
        : (MACRO_KEYS as readonly string[]).includes(key)
          ? (e: { target: { value: string } }) => setMacro(key as MacroKey, e.target.value)
          : set(key);
    return (
      <label className="field">
        <span>
          {label}
          {opts.required ? '' : ' (optional)'}
        </span>
        <input
          value={text[key]}
          onChange={onChange}
          inputMode={opts.numeric ? 'decimal' : undefined}
          autoComplete="off"
          placeholder={opts.placeholder}
          aria-required={opts.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${formId}-${key}-error` : undefined}
        />
        {error && (
          <span id={`${formId}-${key}-error`} className="field-error">
            {error}
          </span>
        )}
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
      {validGrams(base?.grams) && (
        <label className="checkbox small">
          <input
            type="checkbox"
            checked={autoScale}
            onChange={(e) => setAutoScale(e.target.checked)}
          />
          Rescale macros when serving grams change (from {toInputValue(base?.grams)} g)
        </label>
      )}
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
            onClick={() => setMacro('calories', String(Math.round(calorieCheck.expected)))}
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
