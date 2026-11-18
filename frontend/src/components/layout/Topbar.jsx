import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, ScanBarcode } from 'lucide-react'
import Button from '../ui/Button'
import UserMenu from './UserMenu'
import Kbd from '../ui/Kbd'
import GlobalSearch from './GlobalSearch'
import { useAuth } from '../../contexts/AuthContext'
import { can } from '../../utils/permissions'

export default function Topbar({ onOpenMobile }) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const canBill = can(user, 'billing.add_bill')

  // "N" (when not typing and no dialog is open) or Alt+N (anywhere) opens a new bill.
  useEffect(() => {
    if (!canBill) return
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.repeat) return
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable
      const dialogOpen = document.body.style.overflow === 'hidden'  // Modal locks scrolling
      const plain = e.code === 'KeyN' && !e.altKey && !e.shiftKey && !typing && !dialogOpen
      const alt = e.code === 'KeyN' && e.altKey && !e.shiftKey
      if (plain || alt) { e.preventDefault(); navigate('/pos') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [canBill, navigate])

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur sm:px-6">
      <button onClick={onOpenMobile} className="-ml-1 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 lg:hidden" aria-label="Open menu">
        <Menu size={20} />
      </button>
      {can(user, 'billing.view_bill') ? <GlobalSearch /> : <div className="flex-1" />}
      <div className="flex-1 sm:hidden" />
      {/* Pages with their own New bill action don't need a second one. */}
      {canBill && !['/pos', '/dashboard', '/sales'].includes(pathname) && (
        <Button as={Link} to="/pos" variant="primary" size="sm" icon={ScanBarcode} data-tour="new-bill" title="New bill (N)">
          <span className="hidden sm:inline">New bill</span>
          <Kbd onDark>N</Kbd>
        </Button>
      )}
      <UserMenu />
    </header>
  )
}
