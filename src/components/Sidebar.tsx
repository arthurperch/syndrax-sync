import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', icon: '⊞', label: 'Dashboard' },
  { path: '/orders', icon: '📦', label: 'Orders' },
  { path: '/inventory', icon: '📊', label: 'Inventory' },
  { path: '/seo', icon: '✨', label: 'SEO AI' },
  { path: '/competitors', icon: '🔍', label: 'Research' },
  { path: '/settings', icon: '⚙', label: 'Settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">S</div>
      {navItems.map(item => (
        <button
          key={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
          title={item.label}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  );
}
