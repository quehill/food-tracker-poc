import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../errors';
import turkeyBranded from './fixtures/turkey-breast-branded.json';
import turkeyGeneric from './fixtures/turkey-breast-generic.json';
import { createUsdaProvider } from './usdaProvider';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Serves the recorded fixtures based on the dataType query param. */
function fixtureFetch() {
  return vi.fn(async (input: string) => {
    const dataType = new URL(input).searchParams.get('dataType');
    return jsonResponse(dataType === 'Branded' ? turkeyBranded : turkeyGeneric);
  });
}

describe('USDA provider', () => {
  it('queries generic and branded data and ranks generic first', async () => {
    const fetchFn = fixtureFetch();
    const provider = createUsdaProvider({ apiKey: 'k', fetchFn });
    const results = await provider.search('  turkey   breast ');

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const urls = fetchFn.mock.calls.map(([u]) => new URL(u));
    expect(urls.map((u) => u.searchParams.get('dataType')).sort()).toEqual([
      'Branded',
      'Foundation,SR Legacy',
    ]);
    for (const u of urls) {
      expect(u.origin + u.pathname).toBe('https://api.nal.usda.gov/fdc/v1/foods/search');
      expect(u.searchParams.get('api_key')).toBe('k');
      expect(u.searchParams.get('query')).toBe('turkey breast');
    }

    const genericCount = turkeyGeneric.foods.length;
    expect(results).toHaveLength(genericCount + turkeyBranded.foods.length);
    expect(results.slice(0, genericCount).every((r) => r.brand === undefined)).toBe(true);
    expect(results[genericCount]?.brand).toBe('Diestel');
  });

  it('caches results per normalized query for the session', async () => {
    const fetchFn = fixtureFetch();
    const provider = createUsdaProvider({ apiKey: 'k', fetchFn });
    await provider.search('Turkey breast');
    await provider.search('turkey  BREAST');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns nothing for a blank query without calling the API', async () => {
    const fetchFn = fixtureFetch();
    expect(await createUsdaProvider({ apiKey: 'k', fetchFn }).search('  ')).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    [429, 'rate-limit'],
    [403, 'auth'],
    [500, 'http'],
  ] as const)('maps HTTP %i to a %s error', async (status, kind) => {
    const provider = createUsdaProvider({
      apiKey: 'k',
      fetchFn: async () => jsonResponse({ error: 'x' }, status),
    });
    await expect(provider.search('egg')).rejects.toMatchObject({ kind, status });
  });

  it('maps fetch failures to a network error', async () => {
    const provider = createUsdaProvider({
      apiKey: 'k',
      fetchFn: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const err = await provider.search('egg').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err).toMatchObject({ kind: 'network' });
  });

  it('propagates aborts and does not cache them', async () => {
    const controller = new AbortController();
    const fetchFn = vi.fn(async (_input: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return jsonResponse(turkeyGeneric);
    });
    const provider = createUsdaProvider({ apiKey: 'k', fetchFn });
    controller.abort();
    await expect(provider.search('turkey', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    await provider.search('turkey');
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });
});
