import { Link } from 'react-router-dom';
import { usdaProvider } from '../../app/providers';
import type { FoodSearchResult } from '../../providers/types';
import { macroLine } from '../format';
import { useProviderSearch } from '../hooks/useProviderSearch';

interface UsdaResultsProps {
  query: string;
  onPick: (result: FoodSearchResult) => void;
}

/** USDA FoodData Central results for `query`, with loading/error/manual-entry fallbacks. */
export function UsdaResults({ query, onPick }: UsdaResultsProps) {
  const state = useProviderSearch(usdaProvider, query, true);

  if (!usdaProvider) {
    return (
      <p className="notice">
        USDA lookup isn&apos;t set up in this build (no API key).{' '}
        <Link to="/foods/new">Add the food manually</Link>.
      </p>
    );
  }

  return (
    <section
      className="quick-section"
      aria-label="USDA results"
      aria-busy={state.status === 'loading'}
    >
      <h2 className="section-title">USDA FoodData Central</h2>
      {state.status === 'idle' && (
        <p className="small muted">Type at least 2 characters to search USDA.</p>
      )}
      {state.status === 'loading' && <p className="small muted">Searching USDA…</p>}
      {state.status === 'error' && (
        <p className="notice" role="alert">
          {state.message} <Link to="/foods/new">New food</Link>
        </p>
      )}
      {state.status === 'done' && state.results.length === 0 && (
        <p className="small muted">
          No USDA results for &ldquo;{query.trim()}&rdquo;.{' '}
          <Link to="/foods/new">Add it manually</Link>.
        </p>
      )}
      {state.status === 'done' && state.results.length > 0 && (
        <ul className="list">
          {state.results.map((r) => (
            <li key={`${r.provider}:${r.sourceId}`} className="list-item">
              <button type="button" className="list-item-main" onClick={() => onPick(r)}>
                <div className="list-item-title">{r.name}</div>
                <div className="list-item-sub">
                  {r.brand ?? 'Generic'} · {r.serving.label}
                </div>
                <div className="list-item-sub">
                  {macroLine(r.macrosPerServing)}
                  {r.caloriesEstimated ? ' (kcal estimated)' : ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
