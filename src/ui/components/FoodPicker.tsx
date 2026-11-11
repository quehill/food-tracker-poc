import { useMemo, useState } from 'react';
import { importSearchResult } from '../../app/actions';
import type { Food } from '../../domain/types';
import { macroLine } from '../format';
import { Sheet } from './Sheet';
import { UsdaResults } from './UsdaResults';

interface FoodPickerProps {
  open: boolean;
  foods: readonly Food[];
  onPick: (food: Food) => void;
  onClose: () => void;
}

export function FoodPicker({ open, foods, onPick, onClose }: FoodPickerProps) {
  const [query, setQuery] = useState('');
  const [usdaOn, setUsdaOn] = useState(false);

  const reset = () => {
    setQuery('');
    setUsdaOn(false);
  };

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
        reset();
        onClose();
      }}
    >
      <input
        type="search"
        className="search-input"
        placeholder="Search my foods"
        aria-label="Search my foods"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value.trim()) setUsdaOn(false);
        }}
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
                reset();
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
      {query.trim() && !usdaOn && (
        <button type="button" className="button block" onClick={() => setUsdaOn(true)}>
          Search USDA for &ldquo;{query.trim()}&rdquo;
        </button>
      )}
      {query.trim() && usdaOn && (
        <UsdaResults
          query={query}
          onPick={async (result) => {
            const food = await importSearchResult(result);
            reset();
            onPick(food);
          }}
        />
      )}
      <button type="button" className="button block" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  );
}
