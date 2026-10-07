import { Link } from 'react-router-dom'
import { EMPTY_LINE, variantLabel } from '../../utils/variant'

// Editable rows of color/size (from Settings) + qty/cost/price; chips of existing
// variants prefill a row with that variant's last cost/price.
export default function AddStockLines({ lines, onChange, variants = [], colors = [], sizes = [], errors = [] }) {
  // Active options, plus any (possibly deactivated) ones existing variants still use,
  // so a restock chip always has a matching option.
  const withVariants = (options, idKey, nameKey) => [
    ...options,
    ...variants
      .filter(v => v[idKey] && !options.some(o => o.id === v[idKey]))
      .filter((v, i, arr) => arr.findIndex(x => x[idKey] === v[idKey]) === i)
      .map(v => ({ id: v[idKey], name: v[nameKey] })),
  ]
  const colorOptions = withVariants(colors, 'color', 'color_name')
  const sizeOptions = withVariants(sizes, 'size', 'size_name')

  const setCell = (i, k, v) => onChange(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const remove = (i) => onChange(lines.filter((_, j) => j !== i))

  const pickVariant = (v) => {
    const line = {
      ...EMPTY_LINE, color: v.color ?? '', size: v.size ?? '',
      cost_price: v.last_cost_price ?? '', price: v.last_price ?? '',
    }
    // Fill the first untouched row, else append.
    const blank = lines.findIndex(l => Object.values(l).every(x => x === ''))
    onChange(blank >= 0 ? lines.map((l, j) => (j === blank ? line : l)) : [...lines, line])
  }

  const cls = (i, k) => `w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white ${errors[i]?.[k] ? 'border-red-400' : 'border-gray-300'}`
  const err = (i, k) => errors[i]?.[k] && <p className="mt-0.5 text-xs text-red-600">{errors[i][k]}</p>

  const select = (i, k, options) => (
    <td className="pr-2 pb-2">
      <select value={String(lines[i][k])} onChange={e => setCell(i, k, e.target.value)} className={cls(i, k)}>
        <option value="">— none —</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {err(i, k)}
    </td>
  )

  const number = (i, k, step) => (
    <td className="pr-2 pb-2">
      <input type="number" min="0" step={step} value={lines[i][k]} onChange={e => setCell(i, k, e.target.value)} className={cls(i, k)} />
      {err(i, k)}
    </td>
  )

  return (
    <div className="space-y-3">
      {variants.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Restock an existing variant:</div>
          <div className="flex flex-wrap gap-2">
            {variants.map(v => (
              <button key={v.id} type="button" onClick={() => pickVariant(v)}
                className="text-xs px-2 py-1 rounded-full border border-gray-300 hover:bg-indigo-50 hover:border-indigo-300">
                {variantLabel(v) || 'Default'} · {v.stock_quantity}
              </button>
            ))}
          </div>
        </div>
      )}

      {(colors.length === 0 || sizes.length === 0) && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          Colors and sizes come from <Link to="/settings" className="underline">Settings</Link>
          {colors.length === 0 && ' — no colors added yet'}.
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr>{['Color', 'Size', 'Qty', 'Cost ₹', 'Price ₹'].map(h => <th key={h} className="text-left text-xs font-medium text-gray-500 pb-1 pr-2">{h}</th>)}<th /></tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="align-top">
              {select(i, 'color', colorOptions)}
              {select(i, 'size', sizeOptions)}
              {number(i, 'quantity', '1')}
              {number(i, 'cost_price', '0.01')}
              {number(i, 'price', '0.01')}
              <td className="pb-2">
                <button type="button" onClick={() => remove(i)} disabled={lines.length === 1}
                  className="px-2 py-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30">&times;</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => onChange([...lines, { ...EMPTY_LINE }])}
        className="text-sm text-indigo-600 hover:text-indigo-800">+ Add line</button>
    </div>
  )
}
