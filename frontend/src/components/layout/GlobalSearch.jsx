import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowLeft, CornerDownLeft, Loader2, Search } from 'lucide-react'
import { search } from '../../api/search'
import useReceipts from '../../hooks/useReceipts'
import ResultRow from '../search/ResultRow'
import { groupResults, targetPath } from '../search/results'

const isPattern = (q) => /^(INV|RET)-?\d+$/i.test(q)
const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)

// Top-bar search over units, bills, returns, customers, products and sellers.
// "/" or ⌘/Ctrl+K focuses it; a scanned barcode + Enter jumps straight to the unit.
export default function GlobalSearch() {
  const navigate = useNavigate()
  const { openBill, openReturn, receipts } = useReceipts()
  const inputRef = useRef(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)       // full-width mode on small screens
  const [result, setResult] = useState({ q: null, data: null })
  const [active, setActive] = useState(-1)

  const term = q.trim()
  const searchable = term.length >= 2 || isPattern(term)
  const loading = searchable && result.q !== term
  // Each group carries the flat index of its first item, for keyboard highlighting.
  const groups = useMemo(() => {
    const list = result.q === term ? groupResults(result.data) : []
    return list.map((g, i) => ({ ...g, offset: list.slice(0, i).reduce((n, x) => n + x.items.length, 0) }))
  }, [result, term])
  const flat = useMemo(() => groups.flatMap(g => g.items.map(item => ({ item, icon: g.icon }))), [groups])

  // Debounced fetch; stale responses are ignored by comparing the query they were for.
  useEffect(() => {
    if (!searchable) return
    let live = true
    const t = setTimeout(() => {
      search(term).then(r => { if (live) setResult({ q: term, data: r.data }) }).catch(() => {})
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [term, searchable])

  // "/" and ⌘K / Ctrl+K focus the box from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setMobile(true)
        setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const close = () => { setOpen(false); setMobile(false); setActive(-1); inputRef.current?.blur() }

  const go = (target) => {
    close(); setQ('')
    if (target.type === 'bill') openBill(target.id)
    else if (target.type === 'return') openReturn(target.id)
    else navigate(targetPath(target))
  }

  const submit = async () => {
    if (active >= 0 && flat[active]) return go(flat[active].item.target)
    if (!searchable) return
    // A scanner types faster than the debounce: search now if results aren't for this text.
    const data = result.q === term ? result.data : await search(term).then(r => r.data).catch(() => null)
    if (data?.exact) return go(data.exact)
    close(); setQ('')
    navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, -1)) }
    else if (e.key === 'Enter') { e.preventDefault(); submit() }
    else if (e.key === 'Escape') { if (q) setQ(''); else close() }
  }

  return (
    <>
      <button onClick={() => { setMobile(true); setTimeout(() => inputRef.current?.focus(), 0) }}
        className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 sm:hidden" aria-label="Search">
        <Search size={20} />
      </button>

      <div className={clsx('min-w-0 flex-1', mobile ? 'fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 border-b border-zinc-200 bg-white px-3 sm:static sm:h-auto sm:border-0 sm:p-0' : 'hidden sm:block')}>
        {mobile && (
          <button onClick={close} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 sm:hidden" aria-label="Close search">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="relative w-full max-w-xl">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true); setActive(-1) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => { setOpen(false); setMobile(false) }, 120)}
            onKeyDown={onKeyDown}
            placeholder="Search barcode, bill, customer, product…"
            className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-16 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            aria-label="Search everything"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 sm:flex">
            {loading
              ? <Loader2 size={14} className="animate-spin text-zinc-400" />
              : !q && <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-sans text-[11px] text-zinc-400">{isMac ? '⌘K' : 'Ctrl K'}</kbd>}
          </span>

          {open && searchable && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[70vh] animate-pop-in overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-pop sm:min-w-[420px]">
              {groups.map(g => (
                <div key={g.key} className="mb-1">
                  <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{g.label}</div>
                  {g.items.map((item, j) => (
                    <ResultRow key={`${g.key}-${item.id}`} item={item} icon={g.icon} active={g.offset + j === active}
                      onHover={() => setActive(g.offset + j)} onSelect={() => go(item.target)} />
                  ))}
                </div>
              ))}
              {!loading && groups.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-zinc-500">No matches for “{term}”.</p>
              )}
              {loading && groups.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-zinc-400">Searching…</p>
              )}
              {groups.length > 0 && (
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { close(); setQ(''); navigate(`/search?q=${encodeURIComponent(term)}`) }}
                  className="mt-1 flex w-full items-center justify-between rounded-lg border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50">
                  <span>See all results for “{term}”</span>
                  <CornerDownLeft size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {receipts}
    </>
  )
}
