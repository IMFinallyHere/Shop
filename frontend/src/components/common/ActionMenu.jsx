import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function ActionMenu({ actions }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.right + window.scrollX,
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !triggerRef.current.contains(e.target))
        setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey) }
  }, [open])

  const defaults = actions.filter(a => a.variant !== 'danger')
  const dangers = actions.filter(a => a.variant === 'danger')

  return (
    <>
      <button
        ref={triggerRef}
        onClick={openMenu}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translateX(-100%)' }}
          className="w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-[9999] py-1"
        >
          {defaults.map(({ label, icon, onClick }) => (
            <button
              key={label}
              onClick={() => { onClick(); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </button>
          ))}
          {dangers.length > 0 && (
            <div className="border-t border-gray-100 mt-1 pt-1">
              {dangers.map(({ label, icon, onClick }) => (
                <button
                  key={label}
                  onClick={() => { onClick(); setOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <span className="text-base leading-none">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
