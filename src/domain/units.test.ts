import { describe, expect, it } from 'vitest';
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg } from './units';

describe('units', () => {
  it('converts pounds and kilograms', () => {
    expect(lbToKg(176)).toBeCloseTo(79.83, 2);
    expect(kgToLb(lbToKg(150))).toBeCloseTo(150, 10);
  });

  it('converts feet and inches to centimeters and back', () => {
    expect(feetInchesToCm(5, 11)).toBeCloseTo(180.34, 2);
    expect(cmToFeetInches(180.34)).toEqual({ feet: 5, inches: 11 });
    expect(cmToFeetInches(182.6)).toEqual({ feet: 6, inches: 0 });
  });
});
