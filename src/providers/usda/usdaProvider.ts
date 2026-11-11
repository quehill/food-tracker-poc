import { ProviderError, isAbortError } from '../errors';
import type { FoodProvider, FoodSearchResult } from '../types';
import {
  dedupeResults,
  GENERIC_DATA_TYPES,
  mapUsdaFoods,
  rankByQueryMatch,
  type UsdaSearchResponse,
} from './mapper';

export const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface UsdaProviderOptions {
  apiKey: string;
  fetchFn?: FetchFn;
  genericPageSize?: number;
  brandedPageSize?: number;
}

/** Below this many all-words matches, also fetch any-word matches to fill the list. */
const MIN_ALL_WORDS_RESULTS = 5;

/**
 * Searches generic (Foundation, SR Legacy) and Branded data in parallel. Each group first asks
 * USDA for items containing every query word (name or brand), topping up with any-word matches
 * when that's sparse. Results are then ranked by how many query words they match; ties keep
 * generic before branded and USDA's own order. Cached per session by query.
 */
export function createUsdaProvider(opts: UsdaProviderOptions): FoodProvider {
  const fetchFn: FetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
  const cache = new Map<string, FoodSearchResult[]>();

  async function request(
    query: string,
    dataTypes: string,
    pageSize: number,
    requireAllWords: boolean,
    signal?: AbortSignal,
  ) {
    const url = new URL(USDA_SEARCH_URL);
    url.searchParams.set('api_key', opts.apiKey);
    url.searchParams.set('query', query);
    url.searchParams.set('dataType', dataTypes);
    url.searchParams.set('pageSize', String(pageSize));
    if (requireAllWords) url.searchParams.set('requireAllWords', 'true');

    let res: Response;
    try {
      res = await fetchFn(url.toString(), { signal });
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw new ProviderError('network', 'Network error');
    }
    if (res.status === 429) throw new ProviderError('rate-limit', 'Rate limited', 429);
    if (res.status === 401 || res.status === 403)
      throw new ProviderError('auth', 'API key rejected', res.status);
    if (!res.ok) throw new ProviderError('http', `HTTP ${res.status}`, res.status);
    try {
      return (await res.json()) as UsdaSearchResponse;
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw new ProviderError('http', 'Invalid response', res.status);
    }
  }

  async function searchGroup(q: string, dataTypes: string, pageSize: number, signal?: AbortSignal) {
    const strict = mapUsdaFoods((await request(q, dataTypes, pageSize, true, signal)).foods);
    const singleWord = !q.includes(' ');
    if (singleWord || strict.length >= MIN_ALL_WORDS_RESULTS) return strict;
    const loose = mapUsdaFoods((await request(q, dataTypes, pageSize, false, signal)).foods);
    return [...strict, ...loose];
  }

  return {
    id: 'usda',
    async search(query, signal) {
      const q = query.trim().replace(/\s+/g, ' ');
      if (!q) return [];
      const key = q.toLowerCase();
      const cached = cache.get(key);
      if (cached) return cached;

      const [generic, branded] = await Promise.all([
        searchGroup(q, GENERIC_DATA_TYPES.join(','), opts.genericPageSize ?? 10, signal),
        searchGroup(q, 'Branded', opts.brandedPageSize ?? 20, signal),
      ]);
      const results = rankByQueryMatch(dedupeResults([...generic, ...branded]), q);
      cache.set(key, results);
      return results;
    },
  };
}
