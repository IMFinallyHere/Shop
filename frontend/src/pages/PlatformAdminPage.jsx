import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getAdminTenants, getTenantUsers } from '../api/shops'
import Spinner from '../components/common/Spinner'
import Modal from '../components/common/Modal'

export default function PlatformAdminPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)   // { tenant, users }
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    getAdminTenants()
      .then(r => setTenants(r.data))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false))
  }, [])

  if (user && !user.is_superuser) return <Navigate to="/shops" replace />

  const openDetail = (slug) => {
    setDetailLoading(true); setDetail({ tenant: '', users: [] })
    getTenantUsers(slug)
      .then(r => setDetail(r.data))
      .catch(() => setDetail({ tenant: slug, users: [] }))
      .finally(() => setDetailLoading(false))
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Platform Admin</h1>
            <p className="text-sm text-gray-500">All shops on this platform · {user?.email}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/shops')} className="text-sm text-gray-600 hover:text-gray-800">My shops</button>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? <Spinner /> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Shop', 'Domain', 'Owner', 'Members', 'Created', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No shops yet</td></tr>
                )}
                {tenants.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{t.name}</td>
                    <td className="px-4 py-3 text-gray-500">{t.domain}</td>
                    <td className="px-4 py-3 text-gray-600">{t.owner_email}</td>
                    <td className="px-4 py-3 text-gray-600">{t.member_count}</td>
                    <td className="px-4 py-3 text-gray-400">{t.created ? new Date(t.created).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(t.slug)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">View users</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`Members — ${detail?.tenant || ''}`} size="md">
        {detailLoading ? <Spinner /> : (
          <div className="space-y-1">
            {(detail?.users ?? []).length === 0 && <p className="text-sm text-gray-400">No members.</p>}
            {(detail?.users ?? []).map(u => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <div className="text-sm text-gray-800">{u.email}</div>
                  <div className="text-xs text-gray-400">{u.group_names?.join(', ') || 'no roles'}</div>
                </div>
                <div className="flex gap-1">
                  {u.is_superuser && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">owner</span>}
                  {u.is_staff && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">staff</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
