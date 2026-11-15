import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, ChevronUp, Plus, Search, Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import Switch from '../ui/Switch'

// Manage a named list (sizes, colors, payment methods): add, rename inline, reorder,
// toggle active, delete. `api` = { create, update, remove } returning promises;
// `onChange` reloads the list. `reorder=false` hides the up/down controls.
//
// Layout: one box on top both searches and adds (type to filter; if nothing matches
// exactly, "Add" creates it), over a fixed-height list that loads more rows as you scroll,
// so the add control is never a long scroll away.
const SEARCH_FROM = 12  // filter the list (and say "Search…") from this many entries
const PAGE = 30         // rows rendered at a time; scrolling near the bottom adds another page

// Colour swatch that saves once, shortly after the picker stops changing (the native
// input fires continuously while dragging).
function HexSwatch({ value, onSave }) {
  const [local, setLocal] = useState(value || '#ffffff')
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const change = (e) => {
    const v = e.target.value
    setLocal(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onSave(v), 500)
  }
  return (
    <input type="color" value={local} onChange={change} title="Swatch" aria-label="Swatch"
      className="h-7 w-7 shrink-0 cursor-pointer rounded-full border border-zinc-200 bg-transparent p-0.5" />
  )
}

export default function OptionList({ items, api, onChange, onError, placeholder, withHex = false, reorder = true }) {
  const [text, setText] = useState('')
  const [hex, setHex] = useState('#000000')
  const [limit, setLimit] = useState(PAGE)
  const [flash, setFlash] = useState(null)  // id of the row just added
  const listRef = useRef(null)

  const fail = (e, fallback) => {
    const d = e.response?.data
    onError(d?.detail || d?.name?.[0] || d?.hex?.[0] || fallback)
  }
  const run = async (fn, fallback) => {
    try { const r = await fn(); onChange(); return r ?? true } catch (e) { fail(e, fallback); return false }
  }

  const long = items.length >= SEARCH_FROM
  const q = text.trim().toLowerCase()
  const filtering = long && q !== ''
  const exists = q !== '' && items.some(o => o.name.toLowerCase() === q)

  const add = async () => {
    const n = text.trim()
    if (!n || exists) return
    const res = await run(() => api.create(withHex ? { name: n, hex } : { name: n }), 'Failed to add.')
    if (!res) return
    if (!long) setText('')  // short lists: clear; long lists keep the text so the new row is the one shown
    const id = res?.data?.id
    if (id != null) { setFlash(id); setTimeout(() => setFlash(f => (f === id ? null : f)), 2500) }
  }
  const rename = async (o, el) => {
    const n = el.value.trim()
    if (n === o.name) return
    // Empty or rejected (e.g. duplicate) → put the saved name back.
    if (!n || !(await run(() => api.update(o.id, { name: n }), 'Failed to rename.'))) el.value = o.name
  }
  // Swap positions with the neighbour: two requests when positions are distinct (the
  // normal case); only if two share a position do we renumber the whole list.
  const move = (index, dir) => run(async () => {
    const j = index + dir
    const a = items[index], b = items[j]
    if (a.position !== b.position) {
      await Promise.all([api.update(a.id, { position: b.position }), api.update(b.id, { position: a.position })])
      return
    }
    const order = items.map(o => o.id)
    ;[order[index], order[j]] = [order[j], order[index]]
    const byId = new Map(items.map(o => [o.id, o]))
    await Promise.all(order.map((id, pos) => (byId.get(id).position === pos ? null : api.update(id, { position: pos }))))
  }, 'Failed to reorder.')

  // Keep each row's index in the full list so reordering targets the right neighbour.
  // While searching, names that start with the text come first.
  const rows = useMemo(() => {
    const all = items.map((o, i) => [o, i])
    if (!filtering) return all
    const hits = all.filter(([o]) => o.name.toLowerCase().includes(q))
    return [...hits.filter(([o]) => o.name.toLowerCase().startsWith(q)), ...hits.filter(([o]) => !o.name.toLowerCase().startsWith(q))]
  }, [items, q, filtering])
  const visible = rows.slice(0, limit)

  // New search → back to the top, first page.
  const onText = (v) => { setText(v); setLimit(PAGE); if (listRef.current) listRef.current.scrollTop = 0 }

  const onScroll = (e) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) setLimit(l => (l < rows.length ? l + PAGE : l))
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {withHex && <input type="color" value={hex} onChange={e => setHex(e.target.value)} className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-zinc-300 bg-white p-1" aria-label="New color swatch" />}
        <div className="relative min-w-0 flex-1">
          {long && <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />}
          <input value={text} onChange={e => onText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder={long ? `Search ${items.length} or type a new name to add…` : placeholder}
            aria-label={long ? 'Search or add' : 'Add'} className={clsx('input w-full', long && 'pl-9')} />
        </div>
        {!exists && <Button variant="primary" icon={Plus} onClick={add} disabled={!text.trim()}>{long && q ? `Add “${text.trim()}”` : 'Add'}</Button>}
      </div>
      {exists && long && <p className="-mt-1.5 mb-2 text-xs text-zinc-500">Already in the list. Edit it below.</p>}

      <div ref={listRef} onScroll={onScroll}
        className="max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto overscroll-contain rounded-lg border border-zinc-200">
        {visible.map(([o, i]) => (
          <div key={o.id} className={clsx('group flex items-center gap-3 px-3 py-2 transition-colors duration-700',
            flash === o.id ? 'bg-brand-50' : 'bg-white hover:bg-zinc-50/60')}>
            {reorder && !filtering && (
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-zinc-400 hover:text-zinc-800 disabled:opacity-20" aria-label="Move up"><ChevronUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-zinc-400 hover:text-zinc-800 disabled:opacity-20" aria-label="Move down"><ChevronDown size={14} /></button>
              </div>
            )}
            {withHex && <HexSwatch key={o.hex} value={o.hex} onSave={v => run(() => api.update(o.id, { hex: v }), 'Failed to update color.')} />}
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
        {items.length === 0 && <p className="bg-white px-3 py-6 text-center text-sm text-zinc-400">None yet — add the first one above.</p>}
        {items.length > 0 && rows.length === 0 && (
          <p className="bg-white px-3 py-6 text-center text-sm text-zinc-400">No match for “{text.trim()}” — press Add to create it.</p>
        )}
      </div>
    </div>
  )
}
