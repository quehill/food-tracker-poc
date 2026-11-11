import { ProviderError, isAbortError } from '../errors';
import type { FoodProvider, FoodSearchResult } from '../types';
import {
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

/**
 * Two requests per search (generic, then branded) so basic ingredients rank first even
 * when branded matches dominate relevance. Results are cached per session by query.
 */
export function createUsdaProvider(opts: UsdaProviderOptions): FoodProvider {
  const fetchFn: FetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
  const cache = new Map<string, FoodSearchResult[]>();

  async function request(query: string, dataTypes: string, pageSize: number, signal?: AbortSignal) {
    const url = new URL(USDA_SEARCH_URL);
    url.searchParams.set('api_key', opts.apiKey);
    url.searchParams.set('query', query);
    url.searchParams.set('dataType', dataTypes);
    url.searchParams.set('pageSize', String(pageSize));

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

  return {
    id: 'usda',
    async search(query, signal) {
      const q = query.trim().replace(/\s+/g, ' ');
      if (!q) return [];
      const key = q.toLowerCase();
      const cached = cache.get(key);
      if (cached) return cached;

      const [generic, branded] = await Promise.all([
        request(q, GENERIC_DATA_TYPES.join(','), opts.genericPageSize ?? 10, signal),
        request(q, 'Branded', opts.brandedPageSize ?? 15, signal),
      ]);
      const results = [
        ...rankByQueryMatch(mapUsdaFoods(generic.foods), q),
        ...rankByQueryMatch(mapUsdaFoods(branded.foods), q),
      ];
      cache.set(key, results);
      return results;
    },
  };
}
