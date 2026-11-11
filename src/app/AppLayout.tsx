import { Outlet } from 'react-router-dom';
import { TabBar } from '../ui/components/TabBar';
import { UpdatePrompt } from '../ui/components/UpdatePrompt';

export function AppLayout() {
  return (
    <div className="app">
      <main className="app-main">
        <Outlet />
      </main>
      <UpdatePrompt />
      <TabBar />
    </div>
  );
}
