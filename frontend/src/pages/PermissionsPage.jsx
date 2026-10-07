import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ChevronRight, KeyRound, Search } from 'lucide-react'
import { getPermissions } from '../api/permissions'
import useQuery from '../hooks/useQuery'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader, { Toolbar } from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'

export default function PermissionsPage() {
  const { data, loading, error } = useQuery(() => getPermissions())
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})

  const grouped = useMemo(() => {
    const filtered = (data ?? []).filter(p =>
      !search || `${p.app_label} ${p.model} ${p.codename} ${p.name}`.toLowerCase().includes(search.toLowerCase())
    )
    return filtered.reduce((acc, p) => {
      const key = `${p.app_label} › ${p.model}`
      if (!acc[key]) acc[key] = []
      acc[key].push(p)
      return acc
    }, {})
  }, [data, search])

  const toggleGroup = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }))
  const expandAll = () => setExpanded(Object.fromEntries(Object.keys(grouped).map(k => [k, true])))
  const collapseAll = () => setExpanded({})

  return (
    <div>
      <PageHeader title="Permissions" subtitle="Everything that can be granted to a user or group. Assign them from Users or Groups."
        actions={<><Button size="sm" onClick={expandAll}>Expand all</Button><Button size="sm" onClick={collapseAll}>Collapse all</Button></>} />

      <Toolbar>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter permissions…" className="input pl-9" />
        </div>
      </Toolbar>
      <ErrorAlert message={error && 'Failed to load permissions.'} />

      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([group, perms]) => {
            const open = expanded[group] || !!search
            return (
              <div key={group} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-card">
                <button onClick={() => toggleGroup(group)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50">
                  <ChevronRight size={16} className={clsx('text-zinc-400 transition-transform', open && 'rotate-90')} />
                  <span className="text-sm font-medium text-zinc-800">{group}</span>
                  <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{perms.length}</span>
                </button>
                {open && (
                  <div className="grid grid-cols-1 gap-2 border-t border-zinc-100 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
                    {perms.map(p => (
                      <div key={p.id} className="flex flex-col gap-0.5">
                        <span className="w-fit rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">{p.codename}</span>
                        <span className="text-xs text-zinc-500">{p.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {Object.keys(grouped).length === 0 && <EmptyState icon={KeyRound} title="No permissions match" />}
        </div>
      )}
    </div>
  )
}
