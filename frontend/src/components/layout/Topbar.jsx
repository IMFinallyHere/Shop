import { Link, useLocation } from 'react-router-dom'
import { Menu, ScanBarcode } from 'lucide-react'
import Button from '../ui/Button'
import UserMenu from './UserMenu'
import GlobalSearch from './GlobalSearch'
import { useAuth } from '../../contexts/AuthContext'
import { can } from '../../utils/permissions'

export default function Topbar({ onOpenMobile }) {
  const { pathname } = useLocation()
  const { user } = useAuth()

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur sm:px-6">
      <button onClick={onOpenMobile} className="-ml-1 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 lg:hidden" aria-label="Open menu">
        <Menu size={20} />
      </button>
      {can(user, 'billing.view_bill') ? <GlobalSearch /> : <div className="flex-1" />}
      <div className="flex-1 sm:hidden" />
      {/* Pages with their own New bill action don't need a second one. */}
      {can(user, 'billing.add_bill') && !['/pos', '/dashboard', '/sales'].includes(pathname) && (
        <Button as={Link} to="/pos" variant="primary" size="sm" icon={ScanBarcode} data-tour="new-bill">
          <span className="hidden sm:inline">New bill</span>
        </Button>
      )}
      <UserMenu />
    </header>
  )
}
