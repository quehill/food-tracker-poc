import { useState } from 'react';
import { Link } from 'react-router-dom';
import { setEntryServings } from '../../app/actions';
import { repos } from '../../app/repos';
import { scaleMacros } from '../../domain/macros';
import { totalsForEntries } from '../../domain/log';
import { targetsForDate } from '../../domain/targets';
import type { LogEntry } from '../../domain/types';
import { DateSwitcher } from '../components/DateSwitcher';
import { ProgressSummary } from '../components/ProgressSummary';
import { QuantityForm } from '../components/QuantityForm';
import { Sheet } from '../components/Sheet';
import { fmtServings, fmtTime, macroLine } from '../format';
import { useRepoQuery } from '../hooks/useRepoQuery';
import { useSelectedDate } from '../hooks/useSelectedDate';

export function TodayScreen() {
  const { date, today, setDate } = useSelectedDate();
  const entries = useRepoQuery(() => repos.log.listByDate(date), [date]);
  const history = useRepoQuery(() => repos.settings.getTargetHistory(), []);
  const targets = history && targetsForDate(history, date);
  const [editing, setEditing] = useState<LogEntry | null>(null);

  const remove = async (entry: LogEntry) => {
    if (window.confirm(`Delete "${entry.name}" from this day?`)) await repos.log.delete(entry.id);
  };

  const addHref = date === today ? '/add' : `/add?date=${date}`;

  return (
    <section className="screen">
      <h1 className="visually-hidden">Daily log</h1>
      <DateSwitcher date={date} today={today} onChange={setDate} />

      {entries && targets && (
        <ProgressSummary totals={totalsForEntries(entries)} targets={targets} />
      )}

      {entries && entries.length === 0 && (
        <p className="empty">Nothing logged{date === today ? ' yet today' : ' on this day'}.</p>
      )}

      {entries && entries.length > 0 && (
        <ul className="list" aria-label="Logged entries">
          {entries.map((entry) => (
            <li key={entry.id} className="list-item">
              <button type="button" className="list-item-main" onClick={() => setEditing(entry)}>
                <div className="list-item-title">{entry.name}</div>
                <div className="list-item-sub">
                  {fmtTime(entry.timestamp)} · {fmtServings(entry.servings)} ×{' '}
                  {entry.servingLabel ?? 'serving'}
                </div>
                <div className="list-item-sub">{macroLine(entry.macros)}</div>
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Delete ${entry.name}`}
                onClick={() => void remove(entry)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="small muted">
        <summary>How are these numbers calculated?</summary>
        <p>
          Each entry = servings × the food&apos;s macros per serving, saved at the moment you logged
          it (editing a food later does not change past entries). Totals are the sum of the entries
          on this day. Remaining = target − total, using the targets in effect on this day. The
          outer ring is calories vs target; the inner ring (and the &quot;% of kcal&quot; figures)
          splits the day&apos;s calories by source: protein and carbs at 4 kcal/g, fat at 9 kcal/g.
          Calories are shown rounded to whole numbers and grams to 0.1 g; stored values are not
          rounded.
        </p>
      </details>

      <Link to={addHref} className="button primary fab">
        + Add
      </Link>

      <Sheet open={editing !== null} title={editing?.name ?? ''} onClose={() => setEditing(null)}>
        {editing && (
          <QuantityForm
            servingLabel={editing.servingLabel}
            macrosPerServing={scaleMacros(editing.macros, 1 / editing.servings)}
            initialServings={editing.servings}
            confirmLabel="Save"
            onCancel={() => setEditing(null)}
            onConfirm={async (servings) => {
              await setEntryServings(editing, servings);
              setEditing(null);
            }}
          />
        )}
      </Sheet>
    </section>
  );
}
