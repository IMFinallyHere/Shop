import { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Check, ChevronDown, Search } from 'lucide-react'

// A styled replacement for <select> (the native popup can't be styled). Same usage:
//   <Select id={id} value={v} onChange={e => set(e.target.value)}>
//     <option value="">None</option>
//     <option value="1" data-hex="#111">Black</option>      ← data-hex shows a swatch
//   </Select>
// onChange gets { target: { value } } like a native select. Long lists get a search box.
// Keyboard: ↑/↓ (opens), Enter/Space to pick, Esc to close, typing jumps/filters.

const SEARCH_FROM = 9  // show the search box from this many options

function readOptions(children) {
  const out = []
  const walk = (nodes) => Children.forEach(nodes, (child) => {
    if (!isValidElement(child)) return
    if (child.type === 'option') {
      const p = child.props
      out.push({
        value: p.value == null ? String(Children.toArray(p.children).join('')) : String(p.value),
        label: Children.toArray(p.children).join(''),
        hex: p['data-hex'],
        disabled: !!p.disabled,
      })
    } else if (child.props?.children) {
      walk(child.props.children)  // fragments / optgroups
    }
  })
  walk(children)
  return out
}

// data-hex: "#rrggbb" → that colour, "multi" → rainbow, "" → empty ring (no swatch set).
function Swatch({ hex }) {
  if (hex === undefined) return null
  return (
    <span
      className={clsx('h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-black/15',
        hex === 'multi' && 'bg-[conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)]')}
      style={hex && hex !== 'multi' ? { backgroundColor: hex } : undefined}
    />
  )
}

export default function Select({
  id, value, onChange, children, disabled = false, invalid = false, className,
  placeholder = 'Select…', 'aria-label': ariaLabel, name, required,
}) {
  const options = useMemo(() => readOptions(children), [children])
  const current = options.find(o => o.value === String(value ?? ''))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const typeahead = useRef({ text: '', at: 0 })
  const listId = useId()
  const searchable = options.length >= SEARCH_FROM

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom
    const up = below < 260 && r.top > below
    setPos({ left: r.left, width: Math.max(r.width, 180), top: up ? undefined : r.bottom + 4, bottom: up ? window.innerHeight - r.top + 4 : undefined, up })
  }

  const openList = () => {
    if (disabled) return
    place(); setQuery('')
    setActive(Math.max(0, options.findIndex(o => o.value === current?.value)))
    setOpen(true)
  }
  const close = (refocus = true) => { setOpen(false); if (refocus) triggerRef.current?.focus() }
  const choose = (o) => {
    if (!o || o.disabled) return
    if (o.value !== String(value ?? '')) onChange?.({ target: { value: o.value, name } })
    close()
  }

  // Keep the menu attached on scroll/resize; close on outside click.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!listRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) close(false)
    }
    const onScroll = (e) => { if (!listRef.current?.contains(e.target)) place() }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => { if (open && searchable) searchRef.current?.focus() }, [open, searchable])

  // Keep the highlighted option in view.
  useLayoutEffect(() => {
    if (!open || active < 0) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const move = (step) => {
    if (!shown.length) return
    let i = active
    for (let n = 0; n < shown.length; n++) {
      i = (i + step + shown.length) % shown.length
      if (!shown[i].disabled) break
    }
    setActive(i)
  }

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList() }
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        // Closed + typing: jump to the next option starting with the typed text.
        const t = typeahead.current
        t.text = (Date.now() - t.at < 700 ? t.text : '') + e.key.toLowerCase(); t.at = Date.now()
        const hit = options.find(o => !o.disabled && o.label.toLowerCase().startsWith(t.text))
        if (hit && hit.value !== String(value ?? '')) onChange?.({ target: { value: hit.value, name } })
      }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(shown.length - 1) }
    else if (e.key === 'Enter' || (e.key === ' ' && !searchable)) { e.preventDefault(); choose(shown[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }  // don't close the modal too
    else if (e.key === 'Tab') close(false)
  }

  const empty = !current || current.value === ''
  return (
    <>
      <button
        ref={triggerRef} id={id} type="button" disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-label={ariaLabel} aria-invalid={invalid || undefined} aria-required={required || undefined}
        onClick={() => (open ? close() : openList())} onKeyDown={onKeyDown}
        className={clsx(
          'input flex items-center gap-2 pr-2 text-left',
          invalid && 'input-error', open && 'border-brand-500 ring-2 ring-brand-500/20', className,
        )}
      >
        {current && <Swatch hex={current.hex} />}
        <span className={clsx('min-w-0 flex-1 truncate', empty && 'text-zinc-500')}>{current?.label || placeholder}</span>
        <ChevronDown size={16} className={clsx('shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')} />
      </button>
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      {open && pos && createPortal(
        <div
          ref={listRef}
          style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
          className={clsx('z-[9999] flex max-h-72 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-pop',
            pos.up ? 'origin-bottom' : 'origin-top', 'animate-pop-in')}
          onKeyDown={onKeyDown}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
              <Search size={14} className="shrink-0 text-zinc-400" />
              <input
                ref={searchRef} value={query} placeholder="Search…" aria-label="Search options"
                onChange={e => { setQuery(e.target.value); setActive(0) }}
                className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
          )}
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="overflow-y-auto overscroll-contain p-1">
            {shown.length === 0 && <li className="px-2.5 py-2 text-sm text-zinc-400">No matches</li>}
            {shown.map((o, i) => {
              const selected = o.value === current?.value
              return (
                <li
                  key={`${o.value}-${i}`} data-index={i} role="option" aria-selected={selected} aria-disabled={o.disabled || undefined}
                  onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => choose(o)}
                  className={clsx(
                    'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm',
                    o.disabled ? 'cursor-not-allowed text-zinc-300' : i === active ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700',
                    selected && 'font-medium text-brand-700',
                    o.value === '' && !selected && 'text-zinc-500',
                  )}
                >
                  <Swatch hex={o.hex} />
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {selected && <Check size={15} className="shrink-0 text-brand-600" />}
                </li>
              )
            })}
          </ul>
        </div>,
        document.body,
      )}
    </>
  )
}
