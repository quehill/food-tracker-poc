import { Outlet } from 'react-router-dom';
import { TabBar } from '../ui/components/TabBar';
import { UpdatePrompt } from '../ui/components/UpdatePrompt';

export function AppLayout() {
  return (
    <div className="app">
      {/* Real element, not a pseudo-element: iOS samples its background for the status bar. */}
      <div className="status-bar-backdrop" aria-hidden="true" />
      <main className="app-main">
        <Outlet />
      </main>
      <UpdatePrompt />
      <TabBar />
    </div>
  );
}
