import { useState } from 'react'

// Manage a short named list (sizes, colors): add, rename inline, reorder, toggle active, delete.
// `api` = { create, update, remove } returning promises; `onChange` reloads the list.
export default function OptionList({ items, api, onChange, onError, placeholder, withHex = false }) {
  const [name, setName] = useState('')
  const [hex, setHex] = useState('#000000')

  const fail = (e, fallback) => {
    const d = e.response?.data
    onError(d?.detail || d?.name?.[0] || d?.hex?.[0] || fallback)
  }
  const run = async (fn, fallback) => {
    try { await fn(); onChange(); return true } catch (e) { fail(e, fallback); return false }
  }

  const add = () => {
    const n = name.trim()
    if (!n) return
    run(async () => { await api.create(withHex ? { name: n, hex } : { name: n }); setName('') }, 'Failed to add.')
  }
  const rename = async (o, el) => {
    const n = el.value.trim()
    if (n === o.name) return
    // Empty or rejected (e.g. duplicate) → put the saved name back.
    if (!n || !(await run(() => api.update(o.id, { name: n }), 'Failed to rename.'))) el.value = o.name
  }
  // Swap positions with the neighbour; renumber first so equal positions can't stall.
  const move = (index, dir) => run(async () => {
    const order = items.map(o => o.id)
    const j = index + dir
    ;[order[index], order[j]] = [order[j], order[index]]
    await Promise.all(order.map((id, pos) => {
      const o = items.find(x => x.id === id)
      return o.position === pos ? null : api.update(id, { position: pos })
    }))
  }, 'Failed to reorder.')

  const input = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'

  return (
    <div>
      <div className="space-y-2 mb-4">
        {items.map((o, i) => (
          <div key={o.id} className="flex items-center gap-3 border border-gray-100 rounded-lg px-3 py-2">
            <div className="flex flex-col leading-none">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs" title="Move up">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs" title="Move down">▼</button>
            </div>
            {withHex && (
              <input type="color" value={o.hex || '#ffffff'} onChange={e => run(() => api.update(o.id, { hex: e.target.value }), 'Failed to update color.')}
                className="w-7 h-7 rounded cursor-pointer border border-gray-200" title="Swatch" />
            )}
            <input key={o.name} defaultValue={o.name} onBlur={e => rename(o, e.target)}
              onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
              className={`flex-1 min-w-0 bg-transparent text-sm px-1 py-0.5 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400 ${o.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`} />
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={o.is_active} onChange={() => run(() => api.update(o.id, { is_active: !o.is_active }), 'Failed to update.')} className="w-4 h-4 text-indigo-600" />
              Active
            </label>
            <button onClick={() => run(() => api.remove(o.id), 'Failed to delete.')} className="text-xs text-red-500 hover:text-red-700">Delete</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">None yet.</p>}
      </div>
      <div className="flex gap-2">
        {withHex && <input type="color" value={hex} onChange={e => setHex(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-gray-200" />}
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder} className={`flex-1 min-w-0 ${input}`} />
        <button onClick={add} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm">Add</button>
      </div>
    </div>
  )
}
