import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadFoodsById, logMeal, newId } from '../../app/actions';
import { repos } from '../../app/repos';
import { toLocalDate } from '../../domain/dates';
import {
  computeMealTotals,
  createMeal,
  MEAL_SERVING_LABEL,
  updateMeal,
  validateMealDraft,
  type MealDraft,
  type MealDraftField,
} from '../../domain/meal';
import {
  gramsFromServings,
  isValidQuantity,
  parseDecimal,
  servingsFromGrams,
} from '../../domain/quantity';
import type { Food, Meal } from '../../domain/types';
import { FoodPicker } from '../components/FoodPicker';
import { QuantityForm } from '../components/QuantityForm';
import { Sheet } from '../components/Sheet';
import { macroLine, toInputValue } from '../format';
import { useRepoQuery } from '../hooks/useRepoQuery';

interface ItemRow {
  key: string;
  foodId: string;
  servingsText: string;
  gramsText: string;
}

function rowFor(foodId: string, servings: number, food: Food | undefined): ItemRow {
  const g = food?.serving.grams;
  return {
    key: newId(),
    foodId,
    servingsText: toInputValue(servings),
    gramsText: g ? toInputValue(gramsFromServings(servings, g)) : '',
  };
}

/** Exact servings for a row, preferring grams when they produced the displayed servings. */
function rowServings(row: ItemRow, food: Food | undefined): number {
  const s = parseDecimal(row.servingsText);
  const sg = food?.serving.grams;
  const g = parseDecimal(row.gramsText);
  if (sg && isValidQuantity(g) && toInputValue(servingsFromGrams(g, sg)) === row.servingsText)
    return servingsFromGrams(g, sg);
  return s;
}

function MealEditor({
  meal: initial,
  foodsById,
}: {
  meal?: Meal;
  foodsById: ReadonlyMap<string, Food>;
}) {
  const navigate = useNavigate();
  // Tracks the stored version so "Save & log" followed by "Save" updates rather than duplicates.
  const [meal, setMeal] = useState(initial);
  const [name, setName] = useState(meal?.name ?? '');
  const [favorite, setFavorite] = useState(meal?.favorite ?? false);
  const [rows, setRows] = useState<ItemRow[]>(
    () => meal?.items.map((i) => rowFor(i.foodId, i.servings, foodsById.get(i.foodId))) ?? [],
  );
  const [errors, setErrors] = useState<Partial<Record<MealDraftField, string>>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [logging, setLogging] = useState<Meal | null>(null);

  const draft: MealDraft = {
    name,
    favorite,
    items: rows.map((r) => ({
      foodId: r.foodId,
      servings: rowServings(r, foodsById.get(r.foodId)),
    })),
  };
  const { totals, missingFoodIds } = computeMealTotals(
    draft.items.filter((i) => isValidQuantity(i.servings)),
    foodsById,
  );

  const updateRow = (key: string, patch: (r: ItemRow, food: Food | undefined) => ItemRow) =>
    setRows((rs) => rs.map((r) => (r.key === key ? patch(r, foodsById.get(r.foodId)) : r)));

  const onServings = (key: string, text: string) =>
    updateRow(key, (r, food) => {
      const s = parseDecimal(text);
      const g = food?.serving.grams;
      return {
        ...r,
        servingsText: text,
        gramsText: g ? (isValidQuantity(s) ? toInputValue(gramsFromServings(s, g)) : '') : '',
      };
    });

  const onGrams = (key: string, text: string) =>
    updateRow(key, (r, food) => {
      const g = parseDecimal(text);
      const sg = food?.serving.grams;
      return {
        ...r,
        gramsText: text,
        servingsText:
          sg && isValidQuantity(g) ? toInputValue(servingsFromGrams(g, sg)) : r.servingsText,
      };
    });

  /** Validates and saves; returns the saved meal or null when invalid. */
  const persist = async (): Promise<Meal | null> => {
    const result = validateMealDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return null;
    }
    if (missingFoodIds.length) {
      setErrors({ items: 'Remove deleted ingredients before saving' });
      return null;
    }
    setErrors({});
    const now = Date.now();
    const saved = meal ? updateMeal(meal, draft, now) : createMeal(draft, { id: newId(), now });
    await repos.meals.save(saved);
    setMeal(saved);
    return saved;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await persist()) navigate('/meals');
  };

  const saveAndLog = async () => {
    const saved = await persist();
    if (saved) setLogging(saved);
  };

  const remove = async () => {
    if (!meal) return;
    if (!window.confirm(`Delete "${meal.name}"? Past log entries keep their saved values.`)) return;
    await repos.meals.delete(meal.id);
    navigate('/meals', { replace: true });
  };

  return (
    <>
      <form className="form" onSubmit={(e) => void submit(e)} noValidate>
        <label className="field">
          <span>Meal name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            placeholder="Turkey sandwich"
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        <h2>Ingredients</h2>
        {rows.length === 0 && <p className="small muted">No ingredients yet.</p>}
        <ul className="list" aria-label="Ingredients">
          {rows.map((row) => {
            const food = foodsById.get(row.foodId);
            const servings = rowServings(row, food);
            return (
              <li key={row.key} className="card ingredient">
                <div className="ingredient-head">
                  <div className="list-item-title">
                    {food ? food.name : <span className="field-error">Deleted food</span>}
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${food?.name ?? 'deleted food'}`}
                    onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                  >
                    ×
                  </button>
                </div>
                {food && (
                  <>
                    <div className={food.serving.grams ? 'field-grid' : undefined}>
                      <label className="field">
                        <span>Servings ({food.serving.label})</span>
                        <input
                          inputMode="decimal"
                          autoComplete="off"
                          value={row.servingsText}
                          onChange={(e) => onServings(row.key, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          aria-invalid={!isValidQuantity(servings)}
                        />
                      </label>
                      {food.serving.grams && (
                        <label className="field">
                          <span>Grams</span>
                          <input
                            inputMode="decimal"
                            autoComplete="off"
                            value={row.gramsText}
                            onChange={(e) => onGrams(row.key, e.target.value)}
                            onFocus={(e) => e.target.select()}
                          />
                        </label>
                      )}
                    </div>
                    <div className="macro-line">
                      {isValidQuantity(servings)
                        ? macroLine(
                            computeMealTotals([{ foodId: food.id, servings }], foodsById).totals,
                          )
                        : 'Enter a quantity greater than 0'}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {errors.items && <p className="field-error">{errors.items}</p>}

        <button type="button" className="button block" onClick={() => setPickerOpen(true)}>
          + Add ingredient
        </button>

        <section className="card" aria-label="Meal totals" aria-live="polite">
          <div className="metric-name">Total per meal</div>
          <div className="metric-value">{macroLine(totals)}</div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            Sum of each ingredient&apos;s servings × its current macros per serving.
          </p>
        </section>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => setFavorite(e.target.checked)}
          />
          Favorite
        </label>

        <div className="button-row">
          <button type="submit" className="button primary">
            {meal ? 'Save' : 'Create meal'}
          </button>
          <button type="button" className="button" onClick={() => void saveAndLog()}>
            Save &amp; log
          </button>
        </div>

        {meal && (
          <button type="button" className="button danger block" onClick={() => void remove()}>
            Delete meal
          </button>
        )}
      </form>

      <FoodPicker
        open={pickerOpen}
        foods={[...foodsById.values()]}
        onClose={() => setPickerOpen(false)}
        onPick={(food) => {
          setRows((rs) => [...rs, rowFor(food.id, 1, food)]);
          setPickerOpen(false);
        }}
      />

      <Sheet
        open={logging !== null}
        title={logging ? `Log ${logging.name}` : ''}
        onClose={() => setLogging(null)}
      >
        {logging && (
          <QuantityForm
            servingLabel={MEAL_SERVING_LABEL}
            macrosPerServing={computeMealTotals(logging.items, foodsById).totals}
            confirmLabel="Log"
            onCancel={() => setLogging(null)}
            onConfirm={async (servings) => {
              await logMeal(logging, servings, toLocalDate(new Date()));
              setLogging(null);
              navigate('/');
            }}
          />
        )}
      </Sheet>
    </>
  );
}

export function MealEditScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  // `null` = loaded but not found; `undefined` = still loading.
  const meal = useRepoQuery(async () => (id ? ((await repos.meals.get(id)) ?? null) : null), [id]);
  const foodsById = useRepoQuery(() => loadFoodsById(), []);

  if (meal === undefined || foodsById === undefined) return null;

  if (id && meal === null) {
    return (
      <section className="screen">
        <h1>Meal not found</h1>
        <button type="button" className="button" onClick={() => navigate('/meals')}>
          Back to meals
        </button>
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>{meal ? 'Edit meal' : 'New meal'}</h1>
        <button type="button" className="button" onClick={() => navigate('/meals')}>
          Cancel
        </button>
      </div>
      <MealEditor key={id ?? 'new'} meal={meal ?? undefined} foodsById={foodsById} />
    </section>
  );
}
