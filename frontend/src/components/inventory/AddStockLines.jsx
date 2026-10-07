import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Plus, X } from 'lucide-react'
import { EMPTY_LINE, variantLabel } from '../../utils/variant'
import { Swatch } from '../ui/Badge'

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

  const cls = (i, k) => clsx('input h-9 py-1.5', errors[i]?.[k] && 'input-error')
  const err = (i, k) => errors[i]?.[k] && <p className="mt-0.5 text-xs text-red-600">{errors[i][k]}</p>

  const select = (i, k, options, label) => (
    <td className="pb-2 pr-2">
      <select value={String(lines[i][k])} onChange={e => setCell(i, k, e.target.value)} className={cls(i, k)} aria-label={label}>
        <option value="">—</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {err(i, k)}
    </td>
  )

  const number = (i, k, step, label, placeholder) => (
    <td className="pb-2 pr-2">
      <input type="number" min="0" step={step} value={lines[i][k]} onChange={e => setCell(i, k, e.target.value)}
        className={cls(i, k)} aria-label={label} placeholder={placeholder} />
      {err(i, k)}
    </td>
  )

  return (
    <div className="space-y-4">
      {variants.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-500">Restock an existing variant</div>
          <div className="flex flex-wrap gap-1.5">
            {variants.map(v => (
              <button key={v.id} type="button" onClick={() => pickVariant(v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 transition-colors hover:border-brand-300 hover:bg-brand-50">
                <Swatch hex={v.color_hex} className="h-2.5 w-2.5" />
                {variantLabel(v) || 'Default'} <span className="tabular-nums text-zinc-400">{v.stock_quantity}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(colors.length === 0 || sizes.length === 0) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Colors and sizes come from <Link to="/settings" className="font-medium underline">Settings</Link>
          {colors.length === 0 && ' — no colors added yet'}.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr>{[['Color', 'w-[24%]'], ['Size', 'w-[18%]'], ['Qty', 'w-[14%]'], ['Cost ₹', ''], ['Price ₹', '']].map(([h, w]) =>
              <th key={h} className={`pb-1.5 pr-2 text-left text-xs font-medium text-zinc-500 ${w}`}>{h}</th>)}<th className="w-10" /></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="align-top">
                {select(i, 'color', colorOptions, 'Color')}
                {select(i, 'size', sizeOptions, 'Size')}
                {number(i, 'quantity', '1', 'Quantity', '0')}
                {number(i, 'cost_price', '0.01', 'Cost price', '0.00')}
                {number(i, 'price', '0.01', 'Selling price', '0.00')}
                <td className="pb-2">
                  <button type="button" onClick={() => remove(i)} disabled={lines.length === 1} aria-label="Remove line"
                    className="rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent">
                    <X size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => onChange([...lines, { ...EMPTY_LINE }])}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        <Plus size={15} /> Add line
      </button>
    </div>
  )
}
