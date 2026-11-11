import { describe, expect, it } from 'vitest';
import { gramsFromServings, isValidQuantity, parseDecimal, servingsFromGrams } from './quantity';

describe('serving <-> grams conversion', () => {
  it('converts grams to servings', () => {
    expect(servingsFromGrams(85, 85)).toBe(1);
    expect(servingsFromGrams(170, 85)).toBe(2);
    expect(servingsFromGrams(42.5, 85)).toBe(0.5);
  });

  it('converts servings to grams', () => {
    expect(gramsFromServings(1.5, 28)).toBe(42);
  });

  it('round-trips', () => {
    expect(gramsFromServings(servingsFromGrams(123, 28), 28)).toBeCloseTo(123, 10);
  });

  it('rejects non-positive serving weight', () => {
    expect(() => servingsFromGrams(10, 0)).toThrow(RangeError);
    expect(() => gramsFromServings(1, -5)).toThrow(RangeError);
  });
});

describe('isValidQuantity', () => {
  it('requires a finite positive number', () => {
    expect(isValidQuantity(0.25)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(-1)).toBe(false);
    expect(isValidQuantity(NaN)).toBe(false);
    expect(isValidQuantity(Infinity)).toBe(false);
  });
});

describe('parseDecimal', () => {
  it('parses dot and comma decimals', () => {
    expect(parseDecimal('1.5')).toBe(1.5);
    expect(parseDecimal(' 1,5 ')).toBe(1.5);
    expect(parseDecimal('.5')).toBe(0.5);
    expect(parseDecimal('2.')).toBe(2);
  });

  it('returns NaN for empty or junk', () => {
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1.2.3')).toBeNaN();
    expect(parseDecimal('1e5')).toBeNaN();
  });
});
