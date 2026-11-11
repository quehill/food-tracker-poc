import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../domain/types';
import { logEntriesToCsv } from './csv';

const entry = (overrides: Partial<LogEntry>): LogEntry => ({
  id: 'e',
  date: '2026-11-10',
  timestamp: new Date(2026, 10, 10, 9, 5).getTime(),
  kind: 'food',
  refId: 'f',
  name: 'Egg',
  servingLabel: '1 large',
  servings: 1,
  macros: { calories: 70, protein: 6, carbs: 0.5, fat: 5 },
  ...overrides,
});

describe('logEntriesToCsv', () => {
  it('writes a header and one row per entry, oldest first', () => {
    const csv = logEntriesToCsv([
      entry({ id: 'b', date: '2026-11-10' }),
      entry({ id: 'a', date: '2026-11-09', name: 'Banana', servings: 1.5 }),
    ]);
    const lines = csv
      .replace(/^\uFEFF/, '')
      .trimEnd()
      .split('\r\n');
    expect(lines[0]).toBe(
      'date,time,name,type,servings,serving,calories_kcal,protein_g,carbs_g,fat_g,label',
    );
    expect(lines[1]).toBe('2026-11-09,09:05,Banana,food,1.5,1 large,70,6,0.5,5,');
    expect(lines[2]).toBe('2026-11-10,09:05,Egg,food,1,1 large,70,6,0.5,5,');
  });

  it('quotes commas and quotes, and rounds float noise', () => {
    const csv = logEntriesToCsv([
      entry({
        name: 'Turkey sandwich, "big"',
        macros: { calories: 0.1 + 0.2, protein: 1 / 3, carbs: 0, fat: 0 },
      }),
    ]);
    expect(csv).toContain('"Turkey sandwich, ""big""",food,1,1 large,0.3,0.33,0,0,');
  });

  it('neutralizes spreadsheet formulas in text cells', () => {
    const csv = logEntriesToCsv([entry({ name: '=HYPERLINK("x")', label: '+1' })]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv.trimEnd().endsWith(",'+1")).toBe(true);
  });
});
