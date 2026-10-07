import { variantLabel } from '../../utils/variant'

const money = (v) => (v == null ? '—' : `₹${Number(v).toLocaleString('en-IN')}`)

// A product's variants with stock, last price and an editable low-stock threshold.
export default function VariantList({ variants, onThreshold, onDelete }) {
  if (!variants.length) return <p className="text-sm text-gray-400">No variants yet — add stock to create them.</p>
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-200">
        <tr>{['Variant', 'In stock', 'Last price', 'Low-stock at', ''].map(h =>
          <th key={h} className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {variants.map(v => (
          <tr key={v.id}>
            <td className="py-2 text-gray-800">
              {v.color_hex && <span className="inline-block w-3 h-3 rounded-full border border-gray-300 mr-2 align-middle" style={{ backgroundColor: v.color_hex }} />}
              {variantLabel(v) || 'Default'}
            </td>
            <td className="py-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${v.is_low_stock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{v.stock_quantity}</span>
            </td>
            <td className="py-2 text-gray-700">{money(v.last_price)}</td>
            <td className="py-2">
              <input type="number" min="0" defaultValue={v.low_stock_threshold}
                onBlur={e => { if (Number(e.target.value) !== v.low_stock_threshold) onThreshold(v, Number(e.target.value)) }}
                className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </td>
            <td className="py-2 text-right">
              <button onClick={() => onDelete(v)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
