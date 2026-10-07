import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, LogOut, Store, Wrench } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getMyShops } from '../api/shops'
import { shopUrlWithTokens } from '../utils/domain'
import AuthLayout from '../components/layout/AuthLayout'
import Spinner from '../components/common/Spinner'
import EmptyState from '../components/ui/EmptyState'
import { initials } from '../utils/format'

export default function ShopPickerPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyShops()
      .then(r => setShops(r.data))
      .catch(() => setShops([]))
      .finally(() => setLoading(false))
  }, [])

  const enterShop = (shop) => {
    if (!shop.domain) return
    window.location.assign(shopUrlWithTokens(shop.domain))
  }

  return (
    <AuthLayout wide title="Choose a shop" subtitle={user?.email}
      footer={<button onClick={logout} className="inline-flex items-center gap-1.5 hover:text-zinc-800"><LogOut size={14} /> Sign out</button>}>
      {user?.is_superuser && (
        <button onClick={() => navigate('/admin')}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-left text-sm text-zinc-700 hover:border-brand-300 hover:bg-brand-50/50">
          <Wrench size={16} className="text-zinc-400" />
          <span className="flex-1 font-medium">Platform admin</span>
          <span className="text-xs text-zinc-500">All shops</span>
          <ChevronRight size={16} className="text-zinc-400" />
        </button>
      )}

      {loading ? <Spinner /> : shops.length === 0 ? (
        <EmptyState icon={Store} title="No shops yet" description="You don't belong to any shop yet. Ask a shop owner to add you." />
      ) : (
        <div className="space-y-2">
          {shops.map(shop => (
            <button key={shop.slug} onClick={() => enterShop(shop)}
              className="group flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white">{initials(shop.name)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-zinc-900">{shop.name}</div>
                <div className="truncate text-xs text-zinc-500">{shop.domain}</div>
              </div>
              <ChevronRight size={18} className="text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
            </button>
          ))}
        </div>
      )}
    </AuthLayout>
  )
}
