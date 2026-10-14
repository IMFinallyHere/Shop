import PrintSheet from '../common/PrintSheet'
import usePrintSettings from '../../hooks/usePrintSettings'

// Thermal heads print grey as speckled dots, so everything prints solid black.
const PRINT_CSS = `
@media print {
  .receipt, .receipt * { color: #000 !important; }
  .receipt { box-shadow: none !important; border-radius: 0 !important; margin: 0 auto !important; }
}
`

// Shared receipt chrome: paper width, shop header and footer from Settings → Printing.
// Thermal widths print as one continuous strip sized to the content; A4 prints a page.
// Children use em-based text sizes so they scale with the paper width.
export default function ReceiptFrame({ title, docTitle, shopName, autoPrint = false, onClose, children }) {
  const s = usePrintSettings()
  const width = Number(s.receipt_width_mm)
  const a4 = width >= 210
  const narrow = width < 70
  const style = a4
    ? { width: '130mm', padding: '12mm 8mm', fontSize: '10pt' }
    : { width: `${width}mm`, padding: narrow ? '3mm 2.5mm' : '4mm 3.5mm', fontSize: narrow ? '8pt' : '9pt' }

  return (
    <PrintSheet
      title={title}
      subtitle={a4 ? 'A4' : `${width} mm roll`}
      css={PRINT_CSS}
      page={a4 ? { width: 210, height: 297 } : { width, height: 'auto' }}
      autoPrint={autoPrint && s.loaded}
      onClose={onClose}
    >
      <div className="receipt mx-auto my-8 rounded-xl bg-white leading-snug text-gray-800 shadow-card" style={style}>
        <div className="mb-[1em] text-center">
          <div className="text-[1.35em] font-bold leading-tight">{s.receipt_shop_name || shopName || 'Shop'}</div>
          {s.receipt_address && <div className="text-[0.85em] text-gray-600">{s.receipt_address}</div>}
          {s.receipt_phone && <div className="text-[0.85em] text-gray-600">Ph: {s.receipt_phone}</div>}
          {s.receipt_gstin && <div className="text-[0.85em] text-gray-600">GSTIN: {s.receipt_gstin}</div>}
          <div className="mt-[0.4em] font-semibold uppercase tracking-wide text-gray-500">{docTitle}</div>
        </div>
        {children}
        {s.receipt_footer && <div className="mt-[1.5em] text-center text-[0.85em] text-gray-500">{s.receipt_footer}</div>}
      </div>
    </PrintSheet>
  )
}
