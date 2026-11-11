import { useNavigate, useParams } from 'react-router-dom';
import { newId } from '../../app/actions';
import { repos } from '../../app/repos';
import { createFood, draftFromFood, updateFood, type FoodDraft } from '../../domain/food';
import { FoodForm } from '../components/FoodForm';
import { useRepoQuery } from '../hooks/useRepoQuery';

export function FoodEditScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  // `null` = loaded but not found; `undefined` = still loading.
  const food = useRepoQuery(async () => (id ? ((await repos.foods.get(id)) ?? null) : null), [id]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/foods');
  };

  const save = async (draft: FoodDraft) => {
    const now = Date.now();
    await repos.foods.save(
      food ? updateFood(food, draft, now) : createFood(draft, { id: newId(), now }),
    );
    goBack();
  };

  const remove = async () => {
    if (!food) return;
    if (!window.confirm(`Delete "${food.name}"? Past log entries keep their saved values.`)) return;
    await repos.foods.delete(food.id);
    navigate('/foods', { replace: true });
  };

  if (id && food === undefined) return null;

  if (id && food === null) {
    return (
      <section className="screen">
        <h1>Food not found</h1>
        <button type="button" className="button" onClick={() => navigate('/foods')}>
          Back to foods
        </button>
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>{food ? 'Edit food' : 'New food'}</h1>
        <button type="button" className="button" onClick={goBack}>
          Cancel
        </button>
      </div>
      <FoodForm
        key={food?.id ?? 'new'}
        initial={food ? draftFromFood(food) : undefined}
        caloriesEstimated={food?.caloriesEstimated}
        submitLabel={food ? 'Save' : 'Create food'}
        onSubmit={(draft) => void save(draft)}
      />
      {food && (
        <button type="button" className="button danger block" onClick={() => void remove()}>
          Delete food
        </button>
      )}
    </section>
  );
}
