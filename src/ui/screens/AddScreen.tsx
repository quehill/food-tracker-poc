import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logFood } from '../../app/actions';
import { repos } from '../../app/repos';
import type { Food } from '../../domain/types';
import { QuantityForm } from '../components/QuantityForm';
import { Sheet } from '../components/Sheet';
import { fmtDateLabel, macroLine } from '../format';
import { useRepoQuery } from '../hooks/useRepoQuery';
import { useSelectedDate } from '../hooks/useSelectedDate';

function matches(food: Food, q: string): boolean {
  return `${food.name} ${food.brand ?? ''}`.toLowerCase().includes(q);
}

/** Most recently used first; never-used foods follow, alphabetically. */
function byRecency(a: Food, b: Food): number {
  return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name);
}

export function AddScreen() {
  const { date, today } = useSelectedDate();
  const navigate = useNavigate();
  const foods = useRepoQuery(() => repos.foods.list(), []);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [status, setStatus] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (foods ?? []).filter((f) => !q || matches(f, q)).sort(byRecency);
  }, [foods, query]);

  const todayHref = date === today ? '/' : `/?date=${date}`;

  const quickLog = async (food: Food) => {
    await logFood(food, 1, date);
    setStatus(`Logged 1 × ${food.name}`);
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>Add</h1>
        <span className="muted small">to {fmtDateLabel(date, today)}</span>
      </div>

      <input
        type="search"
        className="search-input"
        placeholder="Search my foods"
        aria-label="Search my foods"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <p className="small muted" role="status" aria-live="polite">
        {status}
      </p>

      {foods && foods.length === 0 && (
        <p className="empty">
          No foods yet. <Link to="/foods/new">Create one</Link>, or load sample data in Settings.
        </p>
      )}

      {foods && foods.length > 0 && visible.length === 0 && (
        <p className="empty">No foods match &ldquo;{query}&rdquo;.</p>
      )}

      <ul className="list" aria-label="Foods">
        {visible.map((food) => (
          <li key={food.id} className="list-item">
            <button type="button" className="list-item-main" onClick={() => setSelected(food)}>
              <div className="list-item-title">
                {food.favorite ? '★ ' : ''}
                {food.name}
              </div>
              <div className="list-item-sub">
                {food.serving.label} · {macroLine(food.macrosPerServing)}
              </div>
            </button>
            <button
              type="button"
              className="button"
              aria-label={`Log 1 serving of ${food.name}`}
              onClick={() => void quickLog(food)}
            >
              +1
            </button>
          </li>
        ))}
      </ul>

      <Link to="/foods/new" className="button block">
        New food
      </Link>

      <Sheet
        open={selected !== null}
        title={selected?.name ?? ''}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <QuantityForm
            servingLabel={selected.serving.label}
            servingGrams={selected.serving.grams}
            macrosPerServing={selected.macrosPerServing}
            confirmLabel="Log"
            onCancel={() => setSelected(null)}
            onConfirm={async (servings) => {
              await logFood(selected, servings, date);
              setSelected(null);
              navigate(todayHref);
            }}
          />
        )}
      </Sheet>
    </section>
  );
}
