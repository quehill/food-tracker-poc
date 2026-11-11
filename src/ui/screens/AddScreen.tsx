import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logFood, logMeal } from '../../app/actions';
import { repos } from '../../app/repos';
import { computeMealTotals, MEAL_SERVING_LABEL } from '../../domain/meal';
import {
  favoritesOf,
  quickItemKey,
  recentsOf,
  searchQuickItems,
  toQuickItems,
  type QuickItem,
} from '../../domain/quickAdd';
import type { Food, LogEntry, Macros } from '../../domain/types';
import { QuantityForm } from '../components/QuantityForm';
import { Sheet } from '../components/Sheet';
import { fmtDateLabel, macroLine } from '../format';
import { useRepoQuery } from '../hooks/useRepoQuery';
import { useSelectedDate } from '../hooks/useSelectedDate';

interface RowInfo {
  macros: Macros;
  sub: string;
  /** Why it can't be logged, if it can't. */
  blocked?: string;
}

function rowInfo(q: QuickItem, foodsById: ReadonlyMap<string, Food>): RowInfo {
  if (q.kind === 'food') {
    const m = q.item.macrosPerServing;
    return { macros: m, sub: `${q.item.serving.label} · ${macroLine(m)}` };
  }
  const { totals, missingFoodIds } = computeMealTotals(q.item.items, foodsById);
  return {
    macros: totals,
    sub: `Meal · ${macroLine(totals)}`,
    blocked: missingFoodIds.length ? 'Has deleted ingredients; edit the meal to fix' : undefined,
  };
}

function QuickList({
  label,
  items,
  foodsById,
  onOpen,
  onQuickLog,
}: {
  label: string;
  items: QuickItem[];
  foodsById: ReadonlyMap<string, Food>;
  onOpen: (q: QuickItem) => void;
  onQuickLog: (q: QuickItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="quick-section" aria-label={label}>
      <h2 className="section-title">{label}</h2>
      <ul className="list">
        {items.map((q) => {
          const info = rowInfo(q, foodsById);
          return (
            <li key={quickItemKey(q)} className="list-item">
              <button type="button" className="list-item-main" onClick={() => onOpen(q)}>
                <div className="list-item-title">
                  {q.item.favorite ? '★ ' : ''}
                  {q.item.name}
                </div>
                <div className="list-item-sub">{info.sub}</div>
                {info.blocked && <div className="field-error">{info.blocked}</div>}
              </button>
              <button
                type="button"
                className="button"
                aria-label={`Log 1 ${q.kind === 'meal' ? 'meal' : 'serving'} of ${q.item.name}`}
                disabled={!!info.blocked}
                onClick={() => onQuickLog(q)}
              >
                +1
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AddScreen() {
  const { date, today } = useSelectedDate();
  const navigate = useNavigate();
  const foods = useRepoQuery(() => repos.foods.list(), []);
  const meals = useRepoQuery(() => repos.meals.list(), []);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<QuickItem | null>(null);
  const [lastLogged, setLastLogged] = useState<{ entry: LogEntry; before: QuickItem } | null>(null);

  const foodsById = useMemo(() => new Map((foods ?? []).map((f) => [f.id, f])), [foods]);
  const items = useMemo(() => toQuickItems(foods ?? [], meals ?? []), [foods, meals]);
  const searching = query.trim() !== '';

  const sections = useMemo(() => {
    if (searching) return [{ label: 'Results', items: searchQuickItems(items, query) }];
    const favorites = favoritesOf(items);
    const recents = recentsOf(items);
    const shown = new Set([...favorites, ...recents].map(quickItemKey));
    const rest = items
      .filter((q) => !shown.has(quickItemKey(q)))
      .sort((a, b) => a.item.name.localeCompare(b.item.name));
    return [
      { label: 'Favorites', items: favorites },
      { label: 'Recent', items: recents },
      { label: 'All foods and meals', items: rest },
    ];
  }, [items, query, searching]);

  const log = (q: QuickItem, servings: number) =>
    q.kind === 'food' ? logFood(q.item, servings, date) : logMeal(q.item, servings, date);

  const quickLog = async (q: QuickItem) => {
    setLastLogged({ entry: await log(q, 1), before: q });
  };

  const undo = async () => {
    if (!lastLogged) return;
    const { entry, before } = lastLogged;
    await repos.log.delete(entry.id);
    // Restore usage stats so an undone log doesn't count toward Recents.
    if (before.kind === 'food') await repos.foods.save(before.item);
    else await repos.meals.save(before.item);
    setLastLogged(null);
  };

  const loaded = foods !== undefined && meals !== undefined;
  const selectedInfo = selected ? rowInfo(selected, foodsById) : null;

  return (
    <section className="screen">
      <div className="screen-header">
        <h1>Add</h1>
        <span className="muted small">to {fmtDateLabel(date, today)}</span>
      </div>

      <input
        type="search"
        className="search-input"
        placeholder="Search foods and meals"
        aria-label="Search foods and meals"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="status-row" role="status" aria-live="polite">
        {lastLogged && (
          <>
            <span>Logged 1 × {lastLogged.entry.name}</span>
            <button type="button" className="button" onClick={() => void undo()}>
              Undo
            </button>
          </>
        )}
      </div>

      {loaded && items.length === 0 && (
        <p className="empty">
          No foods yet. <Link to="/foods/new">Create one</Link>, or load sample data in Settings.
        </p>
      )}

      {loaded && searching && sections[0]?.items.length === 0 && (
        <p className="empty">Nothing matches &ldquo;{query.trim()}&rdquo;.</p>
      )}

      {loaded &&
        sections.map((s) => (
          <QuickList
            key={s.label}
            label={s.label}
            items={s.items}
            foodsById={foodsById}
            onOpen={setSelected}
            onQuickLog={(q) => void quickLog(q)}
          />
        ))}

      <div className="button-row">
        <Link to="/foods/new" className="button">
          New food
        </Link>
        <Link to="/meals/new" className="button">
          New meal
        </Link>
      </div>

      <Sheet
        open={selected !== null}
        title={selected?.item.name ?? ''}
        onClose={() => setSelected(null)}
      >
        {selected && selectedInfo?.blocked && (
          <>
            <p className="notice">{selectedInfo.blocked}</p>
            <Link to={`/meals/${selected.item.id}`} className="button block">
              Edit meal
            </Link>
          </>
        )}
        {selected && selectedInfo && !selectedInfo.blocked && (
          <QuantityForm
            servingLabel={
              selected.kind === 'food' ? selected.item.serving.label : MEAL_SERVING_LABEL
            }
            servingGrams={selected.kind === 'food' ? selected.item.serving.grams : undefined}
            macrosPerServing={selectedInfo.macros}
            confirmLabel="Log"
            onCancel={() => setSelected(null)}
            onConfirm={async (servings) => {
              await log(selected, servings);
              setSelected(null);
              navigate(date === today ? '/' : `/?date=${date}`);
            }}
          />
        )}
      </Sheet>
    </section>
  );
}
