import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadFoodsById, logMeal } from '../../app/actions';
import { repos } from '../../app/repos';
import { computeMealTotals, MEAL_SERVING_LABEL } from '../../domain/meal';
import type { Meal } from '../../domain/types';
import { LibrarySwitch } from '../components/LibrarySwitch';
import { QuantityForm } from '../components/QuantityForm';
import { Sheet } from '../components/Sheet';
import { macroLine } from '../format';
import { useRepoQuery } from '../hooks/useRepoQuery';
import { useSelectedDate } from '../hooks/useSelectedDate';

export function MealsScreen() {
  const { date, today } = useSelectedDate();
  const navigate = useNavigate();
  const meals = useRepoQuery(() => repos.meals.list(), []);
  const foodsById = useRepoQuery(() => loadFoodsById(), []);
  const [logging, setLogging] = useState<Meal | null>(null);

  const sorted = [...(meals ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>Meals</h1>
        <Link to="/meals/new" className="button primary">
          New meal
        </Link>
      </div>
      <LibrarySwitch current="meals" />

      {meals && meals.length === 0 && (
        <p className="empty">
          No meals yet. A meal combines several foods, like a sandwich, so you can log it in one
          tap.
        </p>
      )}

      {foodsById && (
        <ul className="list" aria-label="Meals">
          {sorted.map((meal) => {
            const { totals, missingFoodIds } = computeMealTotals(meal.items, foodsById);
            return (
              <li key={meal.id} className="list-item">
                <Link to={`/meals/${meal.id}`} className="list-item-main">
                  <div className="list-item-title">
                    {meal.favorite ? '★ ' : ''}
                    {meal.name}
                  </div>
                  <div className="list-item-sub">
                    {meal.items.length} ingredient{meal.items.length === 1 ? '' : 's'} ·{' '}
                    {macroLine(totals)}
                  </div>
                  {missingFoodIds.length > 0 && (
                    <div className="field-error">
                      {missingFoodIds.length} deleted ingredient
                      {missingFoodIds.length === 1 ? '' : 's'}; edit to fix
                    </div>
                  )}
                </Link>
                <button
                  type="button"
                  className="button"
                  aria-label={`Log ${meal.name}`}
                  disabled={missingFoodIds.length > 0}
                  onClick={() => setLogging(meal)}
                >
                  Log
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={logging !== null}
        title={logging ? `Log ${logging.name}` : ''}
        onClose={() => setLogging(null)}
      >
        {logging && foodsById && (
          <QuantityForm
            servingLabel={MEAL_SERVING_LABEL}
            macrosPerServing={computeMealTotals(logging.items, foodsById).totals}
            confirmLabel="Log"
            onCancel={() => setLogging(null)}
            onConfirm={async (servings) => {
              await logMeal(logging, servings, date);
              setLogging(null);
              navigate(date === today ? '/' : `/?date=${date}`);
            }}
          />
        )}
      </Sheet>
    </section>
  );
}
