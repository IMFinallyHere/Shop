import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Select } from '../ui/Field'
import { Copy, Plus, X } from 'lucide-react'
import { EMPTY_LINE, MAX_LINES, marginFromPrice, priceFromMargin, variantLabel } from '../../utils/variant'
import { Swatch } from '../ui/Badge'

// Editable rows of color/size (from Settings) + qty/cost/price; chips of existing
// variants prefill a row with that variant's last cost/price.
export default function AddStockLines({ lines, onChange, variants = [], colors = [], sizes = [], errors = [], requireCost = false }) {
  // Active options, plus any (possibly deactivated) ones existing variants still use,
  // so a restock chip always has a matching option.
  const withVariants = (options, idKey, nameKey) => [
    ...options,
    ...variants
      .filter(v => v[idKey] && !options.some(o => o.id === v[idKey]))
      .filter((v, i, arr) => arr.findIndex(x => x[idKey] === v[idKey]) === i)
      .map(v => ({ id: v[idKey], name: v[nameKey], hex: v.color_hex })),
  ]
  const colorOptions = withVariants(colors, 'color', 'color_name')
  const sizeOptions = withVariants(sizes, 'size', 'size_name')

  // Margin ↔ price stay in step (markup on cost): type a margin and the price fills in,
  // type a price and the margin fills in. Changing the cost keeps the price and refreshes
  // the margin, or fills the price from the margin when there's no price yet.
  const setCell = (i, k, v) => onChange(lines.map((l, j) => {
    if (j !== i) return l
    const next = { ...l, [k]: v }
    if (k === 'margin') { const p = priceFromMargin(next.cost_price, v); if (p !== '') next.price = p }
    else if (k === 'price') next.margin = marginFromPrice(next.cost_price, v)
    else if (k === 'cost_price') {
      if (next.price !== '') next.margin = marginFromPrice(v, next.price)
      else if (next.margin !== '') next.price = priceFromMargin(v, next.margin)
    }
    return next
  }))
  const remove = (i) => onChange(lines.filter((_, j) => j !== i))
  const duplicate = (i) => onChange([...lines.slice(0, i + 1), { ...lines[i] }, ...lines.slice(i + 1)])

  const pickVariant = (v) => {
    const line = {
      ...EMPTY_LINE, color: v.color ?? '', size: v.size ?? '',
      cost_price: v.last_cost_price ?? '', price: v.last_price ?? '',
    }
    line.margin = marginFromPrice(line.cost_price, line.price)
    // Fill the first untouched row, else append.
    const blank = lines.findIndex(l => Object.values(l).every(x => x === ''))
    onChange(blank >= 0 ? lines.map((l, j) => (j === blank ? line : l)) : [...lines, line])
  }

  const cls = (i, k) => clsx('input h-9 py-1.5', errors[i]?.[k] && 'input-error')
  const err = (i, k) => errors[i]?.[k] && <p className="mt-0.5 text-xs text-red-600">{errors[i][k]}</p>

  const select = (i, k, options, label) => (
    <td className="pb-2 pr-2">
      <Select value={String(lines[i][k])} onChange={e => setCell(i, k, e.target.value)} className={cls(i, k)} aria-label={label}>
        <option value="">{k === 'color' ? 'No color' : 'No size'}</option>
        {options.map(o => (
          <option key={o.id} value={o.id} data-hex={k === 'color' ? (/multi/i.test(o.name) ? 'multi' : o.hex || '') : undefined}>{o.name}</option>
        ))}
      </Select>
      {err(i, k)}
    </td>
  )

  // `signed`: margin may be negative (selling below cost).
  const number = (i, k, step, label, placeholder, signed = false) => (
    <td className="pb-2 pr-2">
      <input type="number" min={signed ? undefined : '0'} step={step} value={lines[i][k]} onChange={e => setCell(i, k, e.target.value)}
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
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr>{[['Color', 'w-[20%]'], ['Size', 'w-[14%]'], ['Qty', 'w-[10%]'], [requireCost ? 'Cost ₹' : 'Cost ₹ (optional)', ''], ['Margin %', 'w-[11%]'], ['Price ₹', '']].map(([h, w]) =>
              <th key={h} className={`pb-1.5 pr-2 text-left text-xs font-medium text-zinc-500 ${w}`}>{h}</th>)}<th className="w-16" /></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="align-top">
                {select(i, 'color', colorOptions, 'Color')}
                {select(i, 'size', sizeOptions, 'Size')}
                {number(i, 'quantity', '1', 'Quantity', '0')}
                {number(i, 'cost_price', '0.01', requireCost ? 'Cost price' : 'Cost price (optional)', requireCost ? '0.00' : 'optional')}
                {number(i, 'margin', '0.01', 'Margin percent on cost', '%', true)}
                {number(i, 'price', '0.01', 'Selling price', '0.00')}
                <td className="whitespace-nowrap pb-2">
                  <button type="button" onClick={() => duplicate(i)} disabled={lines.length >= MAX_LINES} aria-label="Duplicate line" title="Duplicate this line"
                    className="rounded-md p-2 text-zinc-400 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30 disabled:hover:bg-transparent">
                    <Copy size={15} />
                  </button>
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
      <button type="button" onClick={() => onChange([...lines, { ...EMPTY_LINE }])} disabled={lines.length >= MAX_LINES}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        <Plus size={15} /> Add line
      </button>
    </div>
  )
}
