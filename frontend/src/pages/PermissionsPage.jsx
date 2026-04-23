import { useEffect, useMemo, useState } from 'react'
import { getPermissions } from '../api/permissions'
import Spinner from '../components/common/Spinner'

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    setLoading(true)
    getPermissions().then(r => setPermissions(r.data)).finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => {
    const filtered = permissions.filter(p =>
      !search || `${p.app_label} ${p.model} ${p.codename} ${p.name}`.toLowerCase().includes(search.toLowerCase())
    )
    return filtered.reduce((acc, p) => {
      const key = `${p.app_label} › ${p.model}`
      if (!acc[key]) acc[key] = []
      acc[key].push(p)
      return acc
    }, {})
  }, [permissions, search])

  const toggleGroup = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }))

  const expandAll = () => setExpanded(Object.fromEntries(Object.keys(grouped).map(k => [k, true])))
  const collapseAll = () => setExpanded({})

  if (loading) return <Spinner />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Permissions</h1>
        <div className="flex gap-2">
          <button onClick={expandAll} className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded-lg">Expand all</button>
          <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">Collapse all</button>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Filter permissions…"
        className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      <div className="space-y-2">
        {Object.entries(grouped).map(([group, perms]) => (
          <div key={group} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">{group}</span>
                <span className="text-xs text-gray-400">{perms.length}</span>
              </div>
              <span className="text-gray-400 text-sm">{expanded[group] ? '▲' : '▼'}</span>
            </button>
            {expanded[group] && (
              <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {perms.map(p => (
                  <div key={p.id} className="flex items-start gap-2">
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{p.codename}</span>
                    <span className="text-xs text-gray-500">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="text-center text-gray-400 py-12">No permissions match</p>
        )}
      </div>
    </div>
  )
}
