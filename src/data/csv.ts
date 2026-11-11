import type { LogEntry } from '../domain/types';

const HEADER = [
  'date',
  'time',
  'name',
  'type',
  'servings',
  'serving',
  'calories_kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'label',
];

function num(n: number): string {
  return String(Math.round(n * 100) / 100 || 0);
}

/** RFC 4180 quoting, plus a leading ' on text that spreadsheets would run as a formula. */
function text(s: string | undefined): string {
  let v = s ?? '';
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function localTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function logEntriesToCsv(entries: readonly LogEntry[]): string {
  const sorted = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.timestamp - b.timestamp,
  );
  const rows = sorted.map((e) =>
    [
      e.date,
      localTime(e.timestamp),
      text(e.name),
      e.kind,
      num(e.servings),
      text(e.servingLabel),
      num(e.macros.calories),
      num(e.macros.protein),
      num(e.macros.carbs),
      num(e.macros.fat),
      text(e.label),
    ].join(','),
  );
  // BOM so Excel opens UTF-8 correctly.
  return '\uFEFF' + [HEADER.join(','), ...rows].join('\r\n') + '\r\n';
}

export function csvFilename(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `macro-tracker-log-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
}
