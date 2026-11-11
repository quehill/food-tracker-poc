import { addDays, isValidLocalDate } from '../../domain/dates';
import type { LocalDate } from '../../domain/types';
import { fmtDateLabel } from '../format';

interface DateSwitcherProps {
  date: LocalDate;
  today: LocalDate;
  onChange: (date: LocalDate) => void;
}

export function DateSwitcher({ date, today, onChange }: DateSwitcherProps) {
  return (
    <div className="date-switcher">
      <button
        type="button"
        className="icon-button"
        aria-label="Previous day"
        onClick={() => onChange(addDays(date, -1))}
      >
        ‹
      </button>
      <label className="date-switcher-label">
        <span>{fmtDateLabel(date, today)}</span>
        <input
          type="date"
          aria-label="Pick a date"
          value={date}
          onChange={(e) => {
            if (isValidLocalDate(e.target.value)) onChange(e.target.value);
          }}
        />
      </label>
      <button
        type="button"
        className="icon-button"
        aria-label="Next day"
        onClick={() => onChange(addDays(date, 1))}
      >
        ›
      </button>
    </div>
  );
}
