import { Link } from 'react-router-dom';

/** Foods | Meals segmented control shown at the top of both library screens. */
export function LibrarySwitch({ current }: { current: 'foods' | 'meals' }) {
  return (
    <nav className="segmented" aria-label="Library">
      <Link
        to="/foods"
        className={current === 'foods' ? 'active' : ''}
        aria-current={current === 'foods' ? 'page' : undefined}
      >
        Foods
      </Link>
      <Link
        to="/meals"
        className={current === 'meals' ? 'active' : ''}
        aria-current={current === 'meals' ? 'page' : undefined}
      >
        Meals
      </Link>
    </nav>
  );
}
