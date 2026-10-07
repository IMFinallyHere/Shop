import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import Button from '../ui/Button'

// Full-screen print preview: a toolbar (hidden when printing) above `children`.
// `css` carries the component's @media print rules; the printed markup is the caller's.
export default function PrintSheet({ title, subtitle, css, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 animate-fade-in overflow-auto bg-zinc-100">
      <style>{css}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900">{title}</div>
          {subtitle && <div className="text-xs text-zinc-500">{subtitle}</div>}
        </div>
        <div className="flex gap-2">
          <Button onClick={onClose} icon={X}>Close</Button>
          <Button variant="primary" onClick={() => window.print()} icon={Printer} autoFocus>Print</Button>
        </div>
      </div>
      {children}
    </div>,
    document.body
  )
}
