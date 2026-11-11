/** Number of servings represented by `grams` of a food whose serving weighs `servingGrams`. */
export function servingsFromGrams(grams: number, servingGrams: number): number {
  if (!(servingGrams > 0)) throw new RangeError('servingGrams must be > 0');
  return grams / servingGrams;
}

export function gramsFromServings(servings: number, servingGrams: number): number {
  if (!(servingGrams > 0)) throw new RangeError('servingGrams must be > 0');
  return servings * servingGrams;
}

export function isValidQuantity(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Parses user-typed decimals; accepts "," as decimal separator. Empty/invalid -> NaN. */
export function parseDecimal(input: string): number {
  const s = input.trim().replace(',', '.');
  if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}
