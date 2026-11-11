import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function UpdatePrompt() {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      registration.current = reg;
    },
  });

  // Installed iOS PWAs are rarely cold-started, so also check on resume and hourly.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') void registration.current?.update();
    };
    const timer = window.setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="update-toast" role="status">
      <button
        type="button"
        className="update-toast-action"
        onClick={() => updateServiceWorker(true)}
      >
        Update available, tap to refresh
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Dismiss update notice"
        onClick={() => setNeedRefresh(false)}
      >
        ×
      </button>
    </div>
  );
}
