import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import Button from '../ui/Button'

const PX_PER_MM = 96 / 25.4

// When printing, only this overlay is laid out (the app underneath is display:none, so it
// can't add blank pages) and the paper size comes from `page`.
const pageCss = (width, height) => {
  const size = width ? `size: ${width}mm ${height}mm;` : ''
  return `
@media print {
  @page { ${size} margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body > *:not(.print-portal) { display: none !important; }
  .print-portal { position: static !important; overflow: visible !important; background: #fff !important; }
  .no-print { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`
}

// Full-screen print preview: a toolbar (hidden when printing) above `children`.
// `page` = { width, height } in mm sets the paper size; height 'auto' measures the content
// just before printing (continuous receipt rolls). `autoPrint` opens the dialog once ready.
// `css` is for any extra rules the caller needs.
export default function PrintSheet({ title, subtitle, css, page, autoPrint = false, onPrint, onClose, children, actions }) {
  const pageW = page?.width
  const pageH = page?.height
  const rootRef = useRef(null)
  const styleRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Re-measure on every print (button or Ctrl+P) so 'auto' height fits the current content.
  useEffect(() => {
    const update = () => {
      const h = pageH !== 'auto' ? pageH
        : rootRef.current ? Math.ceil(rootRef.current.scrollHeight / PX_PER_MM) + 4 : 297
      if (styleRef.current) styleRef.current.textContent = pageCss(pageW, h)
    }
    update()
    window.addEventListener('beforeprint', update)
    return () => window.removeEventListener('beforeprint', update)
  }, [pageW, pageH])

  useEffect(() => {
    if (!autoPrint) return
    const t = setTimeout(() => window.print(), 150)  // let barcodes/canvases paint first
    return () => clearTimeout(t)
  }, [autoPrint])

  return createPortal(
    <div className="print-portal fixed inset-0 z-50 animate-fade-in overflow-auto bg-zinc-100">
      <style ref={styleRef} />
      {css && <style>{css}</style>}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900">{title}</div>
          {subtitle && <div className="text-xs text-zinc-500">{subtitle}</div>}
        </div>
        <div className="flex gap-2">
          {actions}
          <Button onClick={onClose} icon={X}>Close</Button>
          <Button variant="primary" onClick={() => { onPrint?.(); window.print() }} icon={Printer} autoFocus>Print</Button>
        </div>
      </div>
      <div ref={rootRef} className="print-root">{children}</div>
    </div>,
    document.body
  )
}
