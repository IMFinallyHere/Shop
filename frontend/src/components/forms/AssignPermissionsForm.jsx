import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import Button from '../ui/Button'

export default function AssignPermissionsForm({ allPermissions, currentIds, onSave, onCancel, loading }) {
  const [selected, setSelected] = useState(new Set(currentIds))
  const [search, setSearch] = useState('')

  const grouped = useMemo(() => {
    const filtered = allPermissions.filter(p =>
      !search || `${p.app_label} ${p.model} ${p.codename} ${p.name}`.toLowerCase().includes(search.toLowerCase())
    )
    return filtered.reduce((acc, p) => {
      const key = `${p.app_label} › ${p.model}`
      if (!acc[key]) acc[key] = []
      acc[key].push(p)
      return acc
    }, {})
  }, [allPermissions, search])

  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const toggleAll = (perms) => {
    const ids = perms.map(p => p.id)
    const allChecked = ids.every(id => selected.has(id))
    const next = new Set(selected)
    if (allChecked) ids.forEach(id => next.delete(id))
    else ids.forEach(id => next.add(id))
    setSelected(next)
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter permissions…" className="input pl-9" />
      </div>
      <div className="text-xs text-zinc-500">{selected.size} selected</div>
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {Object.entries(grouped).map(([group, perms]) => (
          <div key={group} className="rounded-lg border border-zinc-200 p-3">
            <label className="mb-2 flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={perms.every(p => selected.has(p.id))} onChange={() => toggleAll(perms)} className="h-4 w-4 accent-brand-600" />
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{group}</span>
            </label>
            <div className="grid grid-cols-1 gap-1 pl-6 sm:grid-cols-2">
              {perms.map(p => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="h-3.5 w-3.5 accent-brand-600" />
                  {p.codename}
                </label>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="py-4 text-center text-sm text-zinc-400">No permissions match</p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={() => onSave([...selected])} loading={loading}>Save</Button>
      </div>
    </div>
  )
}
