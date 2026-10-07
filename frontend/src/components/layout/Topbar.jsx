import { Link, useLocation } from 'react-router-dom'
import { Menu, ScanBarcode } from 'lucide-react'
import { findNavItem } from './nav'
import Button from '../ui/Button'
import UserMenu from './UserMenu'

export default function Topbar({ onOpenMobile }) {
  const { pathname } = useLocation()
  const current = findNavItem(pathname)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur sm:px-6">
      <button onClick={onOpenMobile} className="-ml-1 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 lg:hidden" aria-label="Open menu">
        <Menu size={20} />
      </button>
      <div className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-500">{current?.label}</div>
      {pathname !== '/pos' && (
        <Button as={Link} to="/pos" variant="primary" size="sm" icon={ScanBarcode}>
          <span className="hidden sm:inline">New bill</span>
        </Button>
      )}
      <UserMenu />
    </header>
  )
}
