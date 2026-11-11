import { useMemo, useState } from 'react';
import type { Food } from '../../domain/types';
import { macroLine } from '../format';
import { Sheet } from './Sheet';

interface FoodPickerProps {
  open: boolean;
  foods: readonly Food[];
  onPick: (food: Food) => void;
  onClose: () => void;
}

export function FoodPicker({ open, foods, onPick, onClose }: FoodPickerProps) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods
      .filter((f) => !q || `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [foods, query]);

  return (
    <Sheet
      open={open}
      title="Add ingredient"
      onClose={() => {
        setQuery('');
        onClose();
      }}
    >
      <input
        type="search"
        className="search-input"
        placeholder="Search my foods"
        aria-label="Search my foods"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {foods.length === 0 && <p className="empty">No foods yet. Create foods first.</p>}
      {foods.length > 0 && visible.length === 0 && (
        <p className="empty">No foods match &ldquo;{query}&rdquo;.</p>
      )}
      <ul className="list" aria-label="Foods">
        {visible.map((food) => (
          <li key={food.id} className="list-item">
            <button
              type="button"
              className="list-item-main"
              onClick={() => {
                setQuery('');
                onPick(food);
              }}
            >
              <div className="list-item-title">{food.name}</div>
              <div className="list-item-sub">
                {food.serving.label} · {macroLine(food.macrosPerServing)}
              </div>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="button block" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
