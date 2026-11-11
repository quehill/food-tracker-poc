import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { repos } from '../../app/repos';
import { macroLine } from '../format';
import { useRepoQuery } from '../hooks/useRepoQuery';

export function FoodsScreen() {
  const foods = useRepoQuery(() => repos.foods.list(), []);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (foods ?? [])
      .filter((f) => !q || `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [foods, query]);

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>Foods</h1>
        <Link to="/foods/new" className="button primary">
          New food
        </Link>
      </div>

      <input
        type="search"
        className="search-input"
        placeholder="Search my foods"
        aria-label="Search my foods"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {foods && foods.length === 0 && (
        <p className="empty">No foods yet. Create one, or load sample data in Settings.</p>
      )}
      {foods && foods.length > 0 && visible.length === 0 && (
        <p className="empty">No foods match &ldquo;{query}&rdquo;.</p>
      )}

      <ul className="list" aria-label="My foods">
        {visible.map((food) => (
          <li key={food.id}>
            <Link to={`/foods/${food.id}`} className="list-item list-item-main">
              <div style={{ minWidth: 0 }}>
                <div className="list-item-title">
                  {food.favorite ? '★ ' : ''}
                  {food.name}
                  {food.brand ? <span className="muted"> · {food.brand}</span> : null}
                </div>
                <div className="list-item-sub">
                  {food.serving.label} · {macroLine(food.macrosPerServing)}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
