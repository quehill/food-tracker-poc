import { Link, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Today', match: (p: string) => p === '/' },
  { to: '/add', label: 'Add', match: (p: string) => p.startsWith('/add') },
  {
    to: '/foods',
    label: 'Foods',
    // Meals live under the Foods tab (Foods | Meals switch).
    match: (p: string) => p.startsWith('/foods') || p.startsWith('/meals'),
  },
  { to: '/trends', label: 'Trends', match: (p: string) => p.startsWith('/trends') },
  { to: '/settings', label: 'Settings', match: (p: string) => p.startsWith('/settings') },
];

export function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`tab${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
