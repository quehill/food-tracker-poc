type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to "something in storage changed". Returns an unsubscribe function. */
export function subscribeToChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyChange(): void {
  for (const l of [...listeners]) l();
}
