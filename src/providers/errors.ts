export type ProviderErrorKind = 'rate-limit' | 'auth' | 'network' | 'http';

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === 'AbortError'
    : err instanceof Error && err.name === 'AbortError';
}

/** User-facing message for a lookup failure. Always points at manual entry as the fallback. */
export function lookupErrorMessage(err: unknown): string {
  if (err instanceof ProviderError) {
    switch (err.kind) {
      case 'rate-limit':
        return 'USDA rate limit reached. Try again in a while, or add the food manually.';
      case 'auth':
        return 'The USDA API key was rejected. Check VITE_USDA_API_KEY, or add the food manually.';
      case 'network':
        return "Couldn't reach USDA. Check your connection, or add the food manually.";
      case 'http':
        return `USDA lookup failed${err.status ? ` (HTTP ${err.status})` : ''}. Try again, or add the food manually.`;
    }
  }
  return 'USDA lookup failed. Try again, or add the food manually.';
}
