import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { MoreHorizontal } from 'lucide-react'

// actions: [{ label, icon: LucideIcon, onClick, variant?: 'danger' }]
export default function ActionMenu({ actions }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + window.scrollY + 4, left: rect.right + window.scrollX })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !triggerRef.current.contains(e.target))
        setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const defaults = actions.filter(a => a.variant !== 'danger')
  const dangers = actions.filter(a => a.variant === 'danger')

  const item = ({ label, icon: Icon, onClick, variant }) => (
    <button
      key={label}
      onClick={() => { onClick(); setOpen(false) }}
      className={clsx(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
        variant === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-zinc-700 hover:bg-zinc-100',
      )}
    >
      {Icon && <Icon size={15} className={variant === 'danger' ? '' : 'text-zinc-400'} />}
      {label}
    </button>
  )

  return (
    <>
      <button
        ref={triggerRef}
        onClick={openMenu}
        className={clsx('rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700', open && 'bg-zinc-100 text-zinc-700')}
        aria-label="Actions"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translateX(-100%)' }}
          className="z-[9999] w-48 animate-pop-in rounded-lg border border-zinc-200 bg-white p-1 shadow-pop"
        >
          {defaults.map(item)}
          {dangers.length > 0 && (
            <div className={clsx(defaults.length > 0 && 'mt-1 border-t border-zinc-100 pt-1')}>{dangers.map(item)}</div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
