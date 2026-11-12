import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import Button from '../ui/Button'
import { useToast } from '../ui/Toast'
import { directPrinterFor, getDirectPrefs, printNodes } from '../../utils/directPrint'

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
  .print-portal { position: static !important; overflow: visible !important; background: #fff !important; opacity: 1 !important; }
  .no-print { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`
}

// Full-screen print preview: a toolbar (hidden when printing) above `children`.
// `page` = { width, height } in mm sets the paper size; height 'auto' measures the content
// just before printing (continuous receipt rolls). `autoPrint` prints once `ready`.
// `css` is for any extra rules the caller needs.
//
// `direct` = { kind: 'receipt' | 'label', selector, size: node => ({ width, height }) mm, crisp? }
// (`crisp`: print one image dot per printer dot, for labels - see utils/directPrint.js)
// lets Print go straight to this laptop's printer for that kind through QZ Tray (Settings →
// Printing → Direct printing), falling back to the browser dialog if that fails. With
// "Skip the preview" on, sheets that print on open (`autoPrint` / `printOnOpen`) print
// without ever showing and close themselves.
export default function PrintSheet({
  title, subtitle, css, page, autoPrint = false, printOnOpen = false, ready = true,
  direct, onPrint, onClose, children, actions,
}) {
  const pageW = page?.width
  const pageH = page?.height
  const rootRef = useRef(null)
  const onPrintRef = useRef(onPrint)
  const directRef = useRef(direct)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onPrintRef.current = onPrint; directRef.current = direct; onCloseRef.current = onClose })
  const styleRef = useRef(null)
  const toast = useToast()

  // Read once per sheet: changing printers in Settings applies to the next print.
  const [prefs] = useState(getDirectPrefs)
  const printer = direct ? directPrinterFor(direct.kind, prefs) : ''
  const wantsInstant = !!printer && prefs.skipPreview && (autoPrint || printOnOpen)
  const [showPreview, setShowPreview] = useState(!wantsInstant)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Re-measure on every print (button or Ctrl+P) so 'auto' height fits the current content.
  useEffect(() => {
    const update = (e) => {
      if (e?.type === 'beforeprint') onPrintRef.current?.()
      const h = pageH !== 'auto' ? pageH
        : rootRef.current ? Math.ceil(rootRef.current.scrollHeight / PX_PER_MM) + 4 : 297
      if (styleRef.current) styleRef.current.textContent = pageCss(pageW, h)
    }
    update()
    window.addEventListener('beforeprint', update)
    return () => window.removeEventListener('beforeprint', update)
  }, [pageW, pageH])

  const dialogPrint = useCallback(() => {
    setShowPreview(true)
    setTimeout(() => window.print(), 50)  // after the sheet is visible again
  }, [])

  const print = useCallback(async ({ instant = false } = {}) => {
    const d = directRef.current
    if (!printer || !d) return dialogPrint()
    setBusy(true)
    try {
      const nodes = [...(rootRef.current?.querySelectorAll(d.selector) ?? [])]
      await printNodes(printer, nodes, d.size, { jobName: title, profile: prefs.profiles[d.kind], crisp: !!d.crisp })
      onPrintRef.current?.()
      toast(`Printed on ${printer}`)
      if (instant) onCloseRef.current()
    } catch (e) {
      const msg = String(e?.message ?? e)
      console.error('Direct print failed', e)
      const reason = /connect|websocket/i.test(msg) ? 'QZ Tray is not running' : `Direct print failed (${msg.slice(0, 120)})`
      toast(`${reason}. Opening the print dialog.`, 'error')
      dialogPrint()
    } finally {
      setBusy(false)
    }
  }, [printer, prefs, title, toast, dialogPrint])

  useEffect(() => {
    if (!ready || !(autoPrint || wantsInstant)) return
    const t = setTimeout(() => print({ instant: wantsInstant }), 150)  // let barcodes/canvases paint first
    return () => clearTimeout(t)
    // Once per sheet: re-running on `print` identity changes would print twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, autoPrint, wantsInstant])

  return createPortal(
    <div className={`print-portal fixed inset-0 z-50 overflow-auto bg-zinc-100 ${showPreview ? 'animate-fade-in' : 'pointer-events-none opacity-0'}`} aria-hidden={!showPreview}>
      <style ref={styleRef} />
      {css && <style>{css}</style>}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900">{title}</div>
          {(subtitle || printer) && <div className="text-xs text-zinc-500">{[subtitle, printer && `→ ${printer}`].filter(Boolean).join(' · ')}</div>}
        </div>
        <div className="flex gap-2">
          {actions}
          <Button onClick={onClose} icon={X}>Close</Button>
          {printer && <Button onClick={dialogPrint} className="hidden sm:inline-flex">Print dialog…</Button>}
          <Button variant="primary" onClick={() => print()} loading={busy} icon={Printer} autoFocus>Print</Button>
        </div>
      </div>
      <div ref={rootRef} className="print-root">{children}</div>
    </div>,
    document.body
  )
}
