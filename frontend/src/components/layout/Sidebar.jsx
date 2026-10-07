import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { NAV } from './nav'
import Logo from '../ui/Logo'
import { useAuth } from '../../contexts/AuthContext'

// Desktop: fixed column, collapsible to an icon rail. Mobile: off-canvas drawer.
export default function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }) {
  const { user } = useAuth()
  const shopName = user?.shop_name || 'Shop'

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 animate-fade-in bg-zinc-900/30 lg:hidden" onClick={onCloseMobile} />}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-zinc-200 bg-white transition-[width,transform] duration-200 lg:static lg:translate-x-0',
          collapsed ? 'lg:w-[68px]' : 'lg:w-60',
          'w-64',
          mobileOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full',
        )}
      >
        <div className={clsx('flex h-14 shrink-0 items-center gap-2.5 border-b border-zinc-100', collapsed ? 'lg:justify-center lg:px-0' : '', 'px-4')}>
          <Logo size={28} />
          <span className={clsx('truncate text-[15px] font-semibold tracking-tight text-zinc-900', collapsed && 'lg:hidden')} title={shopName}>
            {shopName}
          </span>
          <button onClick={onCloseMobile} className="ml-auto rounded-md p-1 text-zinc-400 hover:bg-zinc-100 lg:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className={clsx('mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400', collapsed && 'lg:invisible lg:h-0 lg:mb-0')}>
                {section}
              </div>
              <div className="space-y-0.5">
                {items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onCloseMobile}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) => clsx(
                      'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      collapsed && 'lg:justify-center lg:px-0',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                    )}
                  >
                    {({ isActive }) => (<>
                      <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className={clsx('shrink-0', isActive ? 'text-brand-600' : 'text-zinc-400 group-hover:text-zinc-600')} />
                      <span className={clsx('truncate', collapsed && 'lg:hidden')}>{label}</span>
                    </>)}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-zinc-100 p-3 lg:block">
          <button
            onClick={onToggleCollapsed}
            className={clsx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800', collapsed && 'justify-center px-0')}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /> Collapse</>}
          </button>
        </div>
      </aside>
    </>
  )
}
