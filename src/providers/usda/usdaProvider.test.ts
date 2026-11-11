import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../errors';
import premierBrandedAll from './fixtures/premier-branded-all-words.json';
import premierBrandedAny from './fixtures/premier-branded-any-words.json';
import premierGenericAll from './fixtures/premier-generic-all-words.json';
import premierGenericAny from './fixtures/premier-generic-any-words.json';
import turkeyBranded from './fixtures/turkey-breast-branded.json';
import turkeyGeneric from './fixtures/turkey-breast-generic.json';
import { createUsdaProvider } from './usdaProvider';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Serves recorded fixtures by query, dataType and requireAllWords. */
function fixtureFetch() {
  return vi.fn(async (input: string) => {
    const p = new URL(input).searchParams;
    const branded = p.get('dataType') === 'Branded';
    const all = p.get('requireAllWords') === 'true';
    if (p.get('query')?.startsWith('premier')) {
      if (branded) return jsonResponse(all ? premierBrandedAll : premierBrandedAny);
      return jsonResponse(all ? premierGenericAll : premierGenericAny);
    }
    return jsonResponse(branded ? turkeyBranded : turkeyGeneric);
  });
}

describe('USDA provider', () => {
  it('asks for all-word matches first, tops up with any-word matches, and dedupes', async () => {
    const fetchFn = fixtureFetch();
    const provider = createUsdaProvider({ apiKey: 'k', fetchFn });
    const results = await provider.search('  turkey   breast ');

    // Fixtures have < 5 all-word matches per group, so each group makes a second request.
    expect(fetchFn).toHaveBeenCalledTimes(4);
    const urls = fetchFn.mock.calls.map(([u]) => new URL(u));
    const calls = urls.map(
      (u) => `${u.searchParams.get('dataType')}|${u.searchParams.get('requireAllWords')}`,
    );
    expect(calls.sort()).toEqual([
      'Branded|null',
      'Branded|true',
      'Foundation,SR Legacy|null',
      'Foundation,SR Legacy|true',
    ]);
    for (const u of urls) {
      expect(u.origin + u.pathname).toBe('https://api.nal.usda.gov/fdc/v1/foods/search');
      expect(u.searchParams.get('api_key')).toBe('k');
      expect(u.searchParams.get('query')).toBe('turkey breast');
    }

    const genericCount = turkeyGeneric.foods.length;
    expect(results).toHaveLength(genericCount + turkeyBranded.foods.length);
    // Equal match quality: generic stays ahead of branded.
    expect(results.slice(0, genericCount).every((r) => r.brand === undefined)).toBe(true);
    expect(results[genericCount]?.brand).toBe('Diestel');
  });

  it('puts the branded product first when it matches the query (brand + name)', async () => {
    const provider = createUsdaProvider({ apiKey: 'k', fetchFn: fixtureFetch() });
    const results = await provider.search('premier protein shake');
    const premier = premierBrandedAll.foods.length;

    expect(results.slice(0, premier).every((r) => r.brand === 'Premier Protein')).toBe(true);
    expect(results[0]?.name).toBe('High Protein Shake');
    const genericShake = results.findIndex((r) => r.name.startsWith('Beverages, nutritional'));
    expect(genericShake).toBeGreaterThanOrEqual(premier);
    // Enough all-word branded matches, so the noisy any-word page (Toll House "Premier White") isn't fetched.
    expect(results.some((r) => r.name.startsWith('Premier White'))).toBe(false);
  });

  it('makes one request per group for single-word queries', async () => {
    const fetchFn = fixtureFetch();
    await createUsdaProvider({ apiKey: 'k', fetchFn }).search('turkey');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('caches results per normalized query for the session', async () => {
    const fetchFn = fixtureFetch();
    const provider = createUsdaProvider({ apiKey: 'k', fetchFn });
    await provider.search('Turkey breast');
    await provider.search('turkey  BREAST');
    expect(fetchFn).toHaveBeenCalledTimes(4);
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
