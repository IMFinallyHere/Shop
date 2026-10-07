import { Trash2 } from 'lucide-react'
import { variantLabel } from '../../utils/variant'
import { moneyShort } from '../../utils/format'
import Badge, { Swatch } from '../ui/Badge'
import EmptyState from '../ui/EmptyState'

// A product's variants with stock, last price and an editable low-stock threshold.
export default function VariantList({ variants, onThreshold, onDelete }) {
  if (!variants.length) return <EmptyState title="No variants yet" description="Add stock to create colors and sizes." />
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50/80">
          <tr className="border-b border-zinc-200">
            {['Variant', 'In stock', 'Last price', 'Alert at ≤', ''].map(h =>
              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-zinc-500">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {variants.map(v => (
            <tr key={v.id}>
              <td className="px-3 py-2">
                <span className="flex items-center gap-2 text-zinc-900"><Swatch hex={v.color_hex} />{variantLabel(v) || 'Default'}</span>
              </td>
              <td className="px-3 py-2">
                <Badge tone={v.stock_quantity === 0 ? 'danger' : v.is_low_stock ? 'warning' : 'success'}>{v.stock_quantity}</Badge>
              </td>
              <td className="px-3 py-2 tabular-nums text-zinc-700">{moneyShort(v.last_price)}</td>
              <td className="px-3 py-2">
                <input type="number" min="0" defaultValue={v.low_stock_threshold} aria-label="Low-stock threshold"
                  onBlur={e => { if (Number(e.target.value) !== v.low_stock_threshold) onThreshold(v, Number(e.target.value)) }}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  className="input h-8 w-20 py-1" />
              </td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => onDelete(v)} className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete variant" title="Delete variant">
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
