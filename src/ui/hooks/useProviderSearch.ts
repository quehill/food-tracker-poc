import { useEffect, useState } from 'react';
import { isAbortError, lookupErrorMessage } from '../../providers/errors';
import type { FoodProvider, FoodSearchResult } from '../../providers/types';

export type ProviderSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; results: FoodSearchResult[] }
  | { status: 'error'; message: string };

export const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/** Debounced provider search; cancels the in-flight request when the query changes. */
export function useProviderSearch(
  provider: FoodProvider | null,
  query: string,
  enabled: boolean,
): ProviderSearchState {
  const [state, setState] = useState<ProviderSearchState>({ status: 'idle' });

  useEffect(() => {
    const q = query.trim();
    if (!provider || !enabled || q.length < MIN_QUERY_LENGTH) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    const timer = window.setTimeout(() => {
      provider.search(q, controller.signal).then(
        (results) => setState({ status: 'done', results }),
        (err: unknown) => {
          if (controller.signal.aborted || isAbortError(err)) return;
          setState({ status: 'error', message: lookupErrorMessage(err) });
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [provider, query, enabled]);

  return state;
}
