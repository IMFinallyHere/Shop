import { NavLink } from 'react-router-dom'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { to: '/products', label: 'Products', icon: '🧵' },
  { to: '/stock', label: 'Stock', icon: '📦' },
  { to: '/categories', label: 'Categories', icon: '🗂️' },
  { to: '/sellers', label: 'Sellers', icon: '🚚' },
  { to: '/pos', label: 'Billing (POS)', icon: '🧾' },
  { to: '/sales', label: 'Sales', icon: '💰' },
  { to: '/customers', label: 'Customers', icon: '🙋' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
  { to: '/users', label: 'Users', icon: '👥' },
  { to: '/groups', label: 'Groups', icon: '🏷️' },
  { to: '/permissions', label: 'Permissions', icon: '🔐' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="px-6 py-5 border-b border-gray-700">
        <span className="font-bold text-lg tracking-tight">Shop Admin</span>
      </div>
      <nav className="flex-1 py-4">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
