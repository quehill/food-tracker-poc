import { useSearchParams } from 'react-router-dom';
import { isValidLocalDate, toLocalDate } from '../../domain/dates';
import type { LocalDate } from '../../domain/types';

/** Selected day from the `?date=` query param; defaults to today. */
export function useSelectedDate(): {
  date: LocalDate;
  today: LocalDate;
  setDate: (d: LocalDate) => void;
} {
  const [params, setParams] = useSearchParams();
  const today = toLocalDate(new Date());
  const param = params.get('date');
  const date = param && isValidLocalDate(param) ? param : today;
  const setDate = (d: LocalDate) => setParams(d === today ? {} : { date: d }, { replace: true });
  return { date, today, setDate };
}
