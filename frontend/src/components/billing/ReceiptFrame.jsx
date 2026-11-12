import { useEffect, useRef } from 'react'
import PrintSheet from '../common/PrintSheet'
import { drawCode128Svg } from '../../utils/barcode'
import usePrintSettings, { receiptPrintableMm } from '../../hooks/usePrintSettings'
import { nodeHeightMm } from '../../utils/directPrint'

// Thermal heads print grey as speckled dots (light-grey lines vanish), so text and rules print solid black.
// `.raster` is the same look for direct printing, which captures the on-screen receipt as an image.
const PRINT_CSS = `
.receipt.raster, .receipt.raster * { color: #000 !important; border-color: #000 !important; }
.receipt.raster { box-shadow: none !important; border-radius: 0 !important; }
@media print {
  .receipt, .receipt * { color: #000 !important; border-color: #000 !important; }
  .receipt { box-shadow: none !important; border-radius: 0 !important; margin: 0 auto !important; }
}
`

// Shared receipt chrome: paper width, shop header and footer from Settings → Printing.
// Thermal widths print as one continuous strip sized to the content; A4 prints a page.
// Children use em-based text sizes so they scale with the paper width.
// Scannable invoice number: scanning it into the global search opens the bill.
function InvoiceBarcode({ value }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) drawCode128Svg(ref.current, value) }, [value])
  return (
    <div className="mt-[1.2em] text-center">
      <div className="mx-auto h-[10mm] w-[85%] bg-white"><svg ref={ref} className="block h-full w-full" /></div>
      <div className="mt-[0.2em] text-[0.85em] tracking-wider">{value}</div>
    </div>
  )
}

export default function ReceiptFrame({ title, docTitle, shopName, autoPrint = false, barcodeValue, onClose, children }) {
  const s = usePrintSettings()
  const width = Number(s.receipt_width_mm)
  const a4 = width >= 210
  // Thermal: lay out (and size the page) to what the head can print, not the paper width.
  const printable = receiptPrintableMm(s)
  const narrow = printable < 60
  const style = a4
    ? { width: '130mm', padding: '12mm 8mm', fontSize: '10pt' }
    : { width: `${printable}mm`, padding: narrow ? '2mm 1.5mm' : '3mm 2mm', fontSize: narrow ? '8pt' : '9pt' }

  return (
    <PrintSheet
      title={title}
      subtitle={a4 ? 'A4' : `${width} mm roll · ${printable} mm printable`}
      css={PRINT_CSS}
      page={a4 ? { width: 210, height: 297 } : { width: printable, height: 'auto' }}
      autoPrint={autoPrint}
      ready={s.loaded}
      direct={a4 ? undefined : { kind: 'receipt', selector: '.receipt', size: node => ({ width: printable, height: nodeHeightMm(node) }) }}
      onClose={onClose}
    >
      <div className="receipt mx-auto my-8 rounded-xl bg-white leading-snug text-gray-800 shadow-card" style={style}>
        <div className="mb-[1em] text-center">
          <div className="text-[1.35em] font-bold leading-tight">{s.receipt_shop_name || shopName || 'Shop'}</div>
          {s.receipt_address && <div className="whitespace-pre-line text-[0.85em] text-gray-600">{s.receipt_address}</div>}
          {s.receipt_phone && <div className="text-[0.85em] text-gray-600">Ph: {s.receipt_phone}</div>}
          {s.receipt_gstin && <div className="text-[0.85em] text-gray-600">GSTIN: {s.receipt_gstin}</div>}
          <div className="mt-[0.4em] font-semibold uppercase tracking-wide text-gray-500">{docTitle}</div>
        </div>
        {children}
        {barcodeValue && s.receipt_show_invoice_barcode && <InvoiceBarcode value={barcodeValue} />}
        {s.receipt_footer && <div className="mt-[1.5em] whitespace-pre-line text-center text-[0.85em] text-gray-500">{s.receipt_footer}</div>}
      </div>
    </PrintSheet>
  )
}
