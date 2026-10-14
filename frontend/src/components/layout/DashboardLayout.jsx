import { Suspense, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import clsx from 'clsx'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Spinner from '../common/Spinner'
import EmptyState from '../ui/EmptyState'
import { NAV, pagePerm } from './nav'
import { useAuth } from '../../contexts/AuthContext'
import { can } from '../../utils/permissions'
import { OnboardingProvider } from '../../onboarding/OnboardingContext'

const COLLAPSE_KEY = 'sidebar_collapsed'
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false } }

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const { user } = useAuth()
  const allowed = can(user, pagePerm(pathname))
  // The default landing page may be off-limits (e.g. no sales access): go to the first allowed one.
  const firstAllowed = NAV.flatMap(s => s.items).find(i => can(user, i.perm))?.to
  const fullBleed = pathname === '/pos'  // POS uses the whole width

  const toggleCollapsed = () => setCollapsed(c => {
    try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* ignore */ }
    return !c
  })

  return (
    <OnboardingProvider>
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className={clsx('mx-auto px-4 py-6 sm:px-6 lg:py-8', fullBleed ? 'max-w-[1400px]' : 'max-w-6xl')}>
            {allowed ? <Suspense fallback={<Spinner className="py-24" />}><Outlet /></Suspense>
              : pathname === '/dashboard' && firstAllowed ? <Navigate to={firstAllowed} replace />
              : <EmptyState icon={Lock} title="No access" description="Ask the shop owner to add you to a group that can open this page." />}
          </div>
        </main>
      </div>
    </div>
    </OnboardingProvider>
  )
}
