import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'

const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl', '2xl': 'max-w-4xl' }

// `footer` renders in a pinned bar under the scrolling body (typically Cancel / Save).
export default function Modal({ isOpen, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [isOpen, onClose])

  if (!isOpen) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-zinc-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={clsx('relative flex max-h-[92vh] w-full animate-pop-in flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl', sizeClass[size])}>
        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-2 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-5 pt-1">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t border-zinc-100 bg-zinc-50/60 px-6 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
