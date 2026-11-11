import { useEffect, useState, type DependencyList } from 'react';
import { subscribeToChanges } from '../../data/changes';

/**
 * Runs an async repository query and re-runs it whenever storage changes or `deps` change.
 * Returns undefined until the first result arrives.
 */
export function useRepoQuery<T>(query: () => Promise<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const run = () => {
      query().then(
        (v) => {
          if (active) setValue(() => v);
        },
        (err: unknown) => console.error('Query failed', err),
      );
    };
    run();
    const unsubscribe = subscribeToChanges(run);
    return () => {
      active = false;
      unsubscribe();
    };
    // `query` is recreated every render; callers pass the values it depends on as `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
