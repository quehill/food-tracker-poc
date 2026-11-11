import type { FoodProvider } from '../providers/types';
import { createUsdaProvider } from '../providers/usda/usdaProvider';

const usdaApiKey = import.meta.env.VITE_USDA_API_KEY?.trim();

/** Null when the build has no USDA key; lookup UI then explains and offers manual entry. */
export const usdaProvider: FoodProvider | null = usdaApiKey
  ? createUsdaProvider({ apiKey: usdaApiKey })
  : null;
