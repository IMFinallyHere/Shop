import { useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import Switch from '../ui/Switch'

// Manage a short named list (sizes, colors, payment methods): add, rename inline,
// reorder, toggle active, delete. `api` = { create, update, remove } returning promises;
// `onChange` reloads the list. `reorder=false` hides the up/down controls.
export default function OptionList({ items, api, onChange, onError, placeholder, withHex = false, reorder = true }) {
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

  return (
    <div>
      <div className="mb-4 divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200">
        {items.map((o, i) => (
          <div key={o.id} className="group flex items-center gap-3 bg-white px-3 py-2 hover:bg-zinc-50/60">
            {reorder && (
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-zinc-400 hover:text-zinc-800 disabled:opacity-20" aria-label="Move up"><ChevronUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-zinc-400 hover:text-zinc-800 disabled:opacity-20" aria-label="Move down"><ChevronDown size={14} /></button>
              </div>
            )}
            {withHex && (
              <input type="color" value={o.hex || '#ffffff'} onChange={e => run(() => api.update(o.id, { hex: e.target.value }), 'Failed to update color.')}
                className="h-7 w-7 shrink-0 cursor-pointer rounded-full border border-zinc-200 bg-transparent p-0.5" title="Swatch" />
            )}
            <input key={o.name} defaultValue={o.name} onBlur={e => rename(o, e.target)} aria-label="Name"
              onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
              className={clsx('min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-sm hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30',
                o.is_active ? 'text-zinc-900' : 'text-zinc-400')} />
            {!o.is_active && <span className="hidden text-xs text-zinc-400 sm:inline">Inactive</span>}
            <Switch checked={o.is_active} label={o.is_active ? 'Active' : 'Inactive'} onChange={() => run(() => api.update(o.id, { is_active: !o.is_active }), 'Failed to update.')} />
            <button onClick={() => run(() => api.remove(o.id), 'Failed to delete.')} aria-label={`Delete ${o.name}`}
              className="rounded-md p-1.5 text-zinc-300 hover:bg-red-50 hover:text-red-600 group-hover:text-zinc-400">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="bg-white px-3 py-6 text-center text-sm text-zinc-400">None yet — add the first one below.</p>}
      </div>
      <div className="flex gap-2">
        {withHex && <input type="color" value={hex} onChange={e => setHex(e.target.value)} className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1" aria-label="New color swatch" />}
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder} className="input min-w-0 flex-1" />
        <Button variant="primary" icon={Plus} onClick={add} disabled={!name.trim()}>Add</Button>
      </div>
    </div>
  )
}
