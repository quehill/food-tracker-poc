import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Today', end: true },
  { to: '/add', label: 'Add', end: false },
  { to: '/foods', label: 'Foods', end: false },
  { to: '/meals', label: 'Meals', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab">
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
