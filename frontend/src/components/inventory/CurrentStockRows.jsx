import clsx from 'clsx'
import { Trash2, Undo2 } from 'lucide-react'
import { Select } from '../ui/Field'
import useCanViewCost from '../../hooks/useCanViewCost'

// The stock a product has right now, one editable row per batch that still has units in stock.
// rows: [{ id, color, size, color_name, size_name, quantity, cost_price, price }] with colour/size as ids.
// Lowering Qty removes the newest units; raising it adds units with fresh barcodes.
// The dustbin marks the whole row for removal (all its in-stock units, e.g. stock added by mistake)
// until Save; Undo brings it back. `removed` is UI-only and sent as quantity 0.
export default function CurrentStockRows({ rows, original, onChange, colors = [], sizes = [], errors = {}, requireCost = false }) {
  const showCost = useCanViewCost()
  const withCurrent = (options, idKey, nameKey) => [
    ...options,
    ...rows
      .filter(r => r[idKey] && !options.some(o => o.id === r[idKey]))
      .filter((r, i, arr) => arr.findIndex(x => x[idKey] === r[idKey]) === i)
      .map(r => ({ id: r[idKey], name: r[nameKey] })),
  ]
  const colorOptions = withCurrent(colors, 'color', 'color_name')
  const sizeOptions = withCurrent(sizes, 'size', 'size_name')
  const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const dirty = (r, i) => r.removed || ['color', 'size', 'quantity', 'cost_price', 'price'].some(k => String(r[k] ?? '') !== String(original[i]?.[k] ?? ''))
  const cls = (i, k) => clsx('input h-9 py-1.5', errors[i]?.[k] && 'input-error')

  if (!rows.length) return <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-sm text-zinc-500">No units in stock yet. Add some below.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead>
          <tr className="text-xs font-medium text-zinc-500">
            <th className="pb-1.5 pr-2 font-medium">Color</th><th className="pb-1.5 pr-2 font-medium">Size</th>
            <th className="w-20 pb-1.5 pr-2 font-medium">Qty</th>
            {showCost && <th className="w-28 pb-1.5 pr-2 font-medium">Cost ₹{requireCost ? '' : ' (optional)'}</th>}
            <th className="w-28 pb-1.5 pr-2 font-medium">Price ₹</th><th className="w-10 pb-1.5"><span className="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={clsx(r.removed ? 'bg-red-50/70 opacity-70' : dirty(r, i) && 'bg-amber-50/60')}>
              <td className="py-1 pr-2">
                <Select value={String(r.color ?? '')} onChange={e => set(i, 'color', e.target.value === '' ? null : Number(e.target.value))} className={cls(i, 'color')} aria-label="Color" disabled={r.removed}>
                  <option value="">No color</option>
                  {colorOptions.map(o => <option key={o.id} value={o.id} data-hex={/multi/i.test(o.name) ? 'multi' : o.hex || ''}>{o.name}</option>)}
                </Select>
              </td>
              <td className="py-1 pr-2">
                <Select value={String(r.size ?? '')} onChange={e => set(i, 'size', e.target.value === '' ? null : Number(e.target.value))} className={cls(i, 'size')} aria-label="Size" disabled={r.removed}>
                  <option value="">No size</option>
                  {sizeOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              </td>
              <td className="py-1 pr-2">
                <input type="number" min="0" step="1" value={r.quantity} onChange={e => set(i, 'quantity', e.target.value)} className={cls(i, 'quantity')} aria-label="Quantity" disabled={r.removed} />
              </td>
              {showCost && <td className="py-1 pr-2">
                <input type="number" min="0" step="0.01" value={r.cost_price ?? ''} placeholder="optional" onChange={e => set(i, 'cost_price', e.target.value)} className={cls(i, 'cost_price')} aria-label="Cost price" disabled={r.removed} />
                {errors[i]?.cost_price && <p className="mt-0.5 text-xs text-red-600">{errors[i].cost_price}</p>}
              </td>}
              <td className="py-1 pr-2">
                <input type="number" min="0" step="0.01" value={r.price} onChange={e => set(i, 'price', e.target.value)} className={cls(i, 'price')} aria-label="Selling price" disabled={r.removed} />
              </td>
              <td className="py-1 text-right">
                <button type="button" onClick={() => set(i, 'removed', !r.removed)} aria-label={r.removed ? 'Keep this stock' : 'Remove this stock'}
                  title={r.removed ? `Undo: keep ${original[i]?.quantity ?? r.quantity} unit(s)` : `Remove all ${original[i]?.quantity ?? r.quantity} unit(s)`}
                  className={clsx('rounded-md p-2', r.removed ? 'text-zinc-600 hover:bg-zinc-100' : 'text-zinc-400 hover:bg-red-100 hover:text-red-600')}>
                  {r.removed ? <Undo2 size={16} /> : <Trash2 size={16} />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
