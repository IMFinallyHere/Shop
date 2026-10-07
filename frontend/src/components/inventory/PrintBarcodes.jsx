import { createPortal } from 'react-dom'
import BarcodeLabel from './BarcodeLabel'

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .print-root, .print-root * { visibility: visible !important; }
  .print-root { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
}
`

// Full-screen overlay showing a grid of printable labels for a set of stock items.
export default function PrintBarcodes({ items, title = 'Barcodes', onClose }) {
  if (!items) return null
  return createPortal(
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      <style>{PRINT_CSS}</style>
      <div className="no-print sticky top-0 bg-gray-50 border-b px-6 py-3 flex items-center justify-between">
        <div className="font-semibold text-gray-800">{title} — {items.length} label{items.length !== 1 ? 's' : ''}</div>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm">🖨 Print</button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Close</button>
        </div>
      </div>
      <div className="print-root p-6 flex flex-wrap gap-4 content-start">
        {items.map(it => (
          <BarcodeLabel key={it.id ?? it.code} full code={it.code} product_name={it.product_name} color_name={it.color_name} size_name={it.size_name} price={it.price} />
        ))}
      </div>
    </div>,
    document.body
  )
}
