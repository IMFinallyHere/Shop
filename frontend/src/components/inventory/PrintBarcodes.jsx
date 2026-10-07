import PrintSheet from '../common/PrintSheet'
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
  return (
    <PrintSheet title={title} subtitle={`${items.length} label${items.length !== 1 ? 's' : ''}`} css={PRINT_CSS} onClose={onClose}>
      <div className="print-root p-6 flex flex-wrap gap-4 content-start">
        {items.map(it => (
          <BarcodeLabel key={it.id ?? it.code} full code={it.code} product_name={it.product_name} color_name={it.color_name} size_name={it.size_name} price={it.price} />
        ))}
      </div>
    </PrintSheet>
  )
}
