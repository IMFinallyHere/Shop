import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const COLLAPSE_KEY = 'sidebar_collapsed'
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false } }

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const fullBleed = pathname === '/pos'  // POS uses the whole width

  const toggleCollapsed = () => setCollapsed(c => {
    try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* ignore */ }
    return !c
  })

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className={clsx('mx-auto px-4 py-6 sm:px-6 lg:py-8', fullBleed ? 'max-w-[1400px]' : 'max-w-6xl')}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
