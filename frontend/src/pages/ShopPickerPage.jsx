import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getMyShops } from '../api/shops'
import { shopUrlWithTokens } from '../utils/domain'
import Spinner from '../components/common/Spinner'

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
    window.location.href = shopUrlWithTokens(shop.domain)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Your shops</h1>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
        </div>

        {user?.is_superuser && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full mb-4 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 px-4 py-3 text-sm font-medium hover:bg-purple-100"
          >
            🛠 Platform Admin — view all shops
          </button>
        )}

        {loading ? <Spinner /> : (
          <div className="space-y-2">
            {shops.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">
                You don't belong to any shop yet.
              </p>
            )}
            {shops.map(shop => (
              <button
                key={shop.slug}
                onClick={() => enterShop(shop)}
                className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <div>
                  <div className="font-medium text-gray-800">{shop.name}</div>
                  <div className="text-xs text-gray-400">{shop.domain}</div>
                </div>
                <span className="text-indigo-500 text-sm">Enter →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
