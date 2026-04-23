import { useMemo, useState } from 'react'

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
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Filter permissions…"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {Object.entries(grouped).map(([group, perms]) => (
          <div key={group} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={perms.every(p => selected.has(p.id))}
                onChange={() => toggleAll(perms)}
                className="w-4 h-4 text-indigo-600"
              />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group}</span>
            </div>
            <div className="grid grid-cols-2 gap-1 pl-6">
              {perms.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="w-3.5 h-3.5 text-indigo-600"
                  />
                  {p.codename}
                </label>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No permissions match</p>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">
          Cancel
        </button>
        <button
          onClick={() => onSave([...selected])}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
