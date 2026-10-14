import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import PrintSheet from '../common/PrintSheet'
import ThermalLabel from './ThermalLabel'
import usePrintSettings from '../../hooks/usePrintSettings'

// One label per printed page, so a thermal roll advances exactly one label each time.
const PRINT_CSS = `
@media print {
  .label-sheet { display: block !important; padding: 0 !important; }
  .thermal-label { break-after: page; outline: none !important; box-shadow: none !important; }
  .thermal-label:last-child { break-after: auto; }
}
`

// Full-screen overlay showing the stock-unit labels at their configured size.
export default function PrintBarcodes({ items, title = 'Barcodes', onClose }) {
  const settings = usePrintSettings()
  if (!items) return null
  const copies = Math.max(1, Number(settings.label_copies) || 1)
  const labels = items.flatMap(it => Array.from({ length: copies }, (_, i) => ({ it, key: `${it.id ?? it.code}-${i}` })))
  return (
    <PrintSheet
      title={title}
      subtitle={`${labels.length} label${labels.length !== 1 ? 's' : ''} · ${settings.label_width_mm}×${settings.label_height_mm} mm`}
      css={PRINT_CSS}
      page={{ width: settings.label_width_mm, height: settings.label_height_mm }}
      onClose={onClose}
      actions={<Link to="/settings?tab=printing" className="no-print hidden items-center gap-1 self-center text-xs text-zinc-500 hover:text-zinc-800 sm:inline-flex" onClick={onClose}><Settings size={14} />Label settings</Link>}
    >
      <div className="label-sheet flex flex-wrap content-start gap-4 p-6">
        {labels.map(({ it, key }) => (
          <ThermalLabel key={key} item={it} settings={settings} className="rounded-sm shadow-card outline outline-1 outline-zinc-200" />
        ))}
      </div>
    </PrintSheet>
  )
}
