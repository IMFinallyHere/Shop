import { useEffect, useState } from 'react'
import { getUsers } from '../api/users'
import { getGroups } from '../api/groups'
import { getPermissions } from '../api/permissions'
import Spinner from '../components/common/Spinner'

export default function DashboardPage() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    Promise.all([getUsers(), getGroups(), getPermissions()]).then(([u, g, p]) => {
      setStats({
        users: u.data.count ?? u.data.length,
        groups: g.data.count ?? g.data.length,
        permissions: p.data.length,
      })
    })
  }, [])

  const cards = stats
    ? [
        { label: 'Total Users', value: stats.users, color: 'indigo' },
        { label: 'Groups', value: stats.groups, color: 'emerald' },
        { label: 'Permissions', value: stats.permissions, color: 'amber' },
      ]
    : []

  const colorMap = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  }

  if (!stats) return <Spinner />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`rounded-xl border p-6 ${colorMap[c.color]}`}>
            <div className="text-3xl font-bold">{c.value}</div>
            <div className="text-sm font-medium mt-1 opacity-80">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
