import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Section from './Section'
import Button from '../ui/Button'
import Switch from '../ui/Switch'
import { updateShopSettings } from '../../api/shopsettings'
import { useToast } from '../ui/Toast'

// Indian clothing (ready-made garments) from 22 Sep 2025: 5% up to ₹2,500 a piece, 18% above.
const CLOTHING = [{ upto: 2500, rate: 5 }, { upto: null, rate: 18 }]

const toForm = (slabs) => slabs.map(s => ({ upto: s.upto == null ? '' : String(s.upto), rate: String(s.rate) }))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Rate for one piece priced `price` (after discount), as billing/tax.py picks it. Only
// used for the example line here; bills are always computed on the server.
function rateFor(price, slabs, inclusive) {
  for (const s of slabs) {
    const rate = Number(s.rate)
    const taxable = inclusive ? price * 100 / (100 + rate) : price
    if (s.upto === '' || s.upto == null || taxable <= Number(s.upto)) return rate
  }
  return 0
}

// GST by price slab, per piece, plus whether tag prices include GST. Owner-only (the
// server checks); cashiers never change tax at the counter.
export default function GstSettings({ initial, onSaved, onError }) {
  const [saved, setSaved] = useState(() => ({ slabs: toForm(initial.tax_slabs), inclusive: initial.prices_include_tax }))
  const [slabs, setSlabs] = useState(saved.slabs)
  const [inclusive, setInclusive] = useState(saved.inclusive)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  const dirty = !same(slabs, saved.slabs) || inclusive !== saved.inclusive

  const setRow = (i, k) => (e) => setSlabs(rows => rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)))
  const addRow = () => setSlabs(rows => {
    const capped = rows.slice(0, -1)
    const last = capped[capped.length - 1]
    const next = { upto: String(last ? Number(last.upto) * 2 || '' : 1000), rate: rows[rows.length - 1].rate }
    return [...capped, next, rows[rows.length - 1]]
  })
  const removeRow = (i) => setSlabs(rows => rows.filter((_, j) => j !== i))

  const save = async () => {
    setSaving(true); setError('')
    try {
      const payload = slabs.map((s, i) => ({ upto: i === slabs.length - 1 ? null : s.upto, rate: s.rate || 0 }))
      const { data } = await updateShopSettings({ tax_slabs: payload, prices_include_tax: inclusive })
      const next = { slabs: toForm(data.tax_slabs), inclusive: data.prices_include_tax }
      setSaved(next); setSlabs(next.slabs); setInclusive(next.inclusive)
      onSaved?.(data)
      toast('GST settings saved')
    } catch (e) {
      const msg = e.response?.data?.tax_slabs?.[0] || e.response?.data?.prices_include_tax?.[0]
      setError(msg || 'Failed to save GST settings.')
      if (!msg) onError?.('Failed to save GST settings.')
    } finally { setSaving(false) }
  }

  const examples = [999, 2999].map(p => [p, rateFor(p, slabs, inclusive)])

  return (
    <Section
      title="GST"
      description="The rate is picked per piece by its price after discount (Indian GST on clothes works per piece). Applied to every bill; cashiers can't change it at the counter."
    >
      <form onSubmit={e => { e.preventDefault(); save() }}>
        <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-zinc-100 pb-3 text-sm text-zinc-700">
          <span>
            <span className="font-medium text-zinc-900">Tag prices include GST</span>
            <span className="block text-xs text-zinc-500">
              {inclusive
                ? 'Customer pays the tag price; the bill shows the GST inside it.'
                : 'GST is added on top of the tag price at the counter.'}
            </span>
          </span>
          <Switch checked={inclusive} onChange={setInclusive} label="Tag prices include GST" />
        </label>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-zinc-900">Rate by price per piece</div>
          <Button size="xs" onClick={() => setSlabs(toForm(CLOTHING))}>Use Indian clothing rates (from 22 Sep 2025)</Button>
        </div>

        <div className="mt-2 space-y-2">
          {slabs.map((s, i) => {
            const last = i === slabs.length - 1
            const prev = slabs[i - 1]
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
                <span className="w-20 text-zinc-500">{last ? (slabs.length === 1 ? 'Every piece' : 'Above') : i === 0 ? 'Up to' : 'Then up to'}</span>
                {last
                  ? <span className="w-32 tabular-nums text-zinc-500">{prev ? `₹${Number(prev.upto || 0).toLocaleString('en-IN')}` : ''}</span>
                  : (
                    <div className="relative w-32">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">₹</span>
                      <input type="number" min="1" step="1" value={s.upto} onChange={setRow(i, 'upto')} className="input w-full pl-7" aria-label={`Slab ${i + 1} limit`} />
                    </div>
                  )}
                <span className="text-zinc-400">→</span>
                <div className="relative w-24">
                  <input type="number" min="0" max="28" step="0.01" value={s.rate} onChange={setRow(i, 'rate')} className="input w-full pr-7" aria-label={`Slab ${i + 1} rate`} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">%</span>
                </div>
                {!last && <Button size="icon" variant="ghost" icon={Trash2} onClick={() => removeRow(i)} aria-label={`Remove slab ${i + 1}`} />}
              </div>
            )
          })}
        </div>
        {slabs.length < 6 && <Button size="xs" variant="ghost" icon={Plus} className="mt-2" onClick={addRow}>Add a slab</Button>}

        <p className="mt-3 text-xs text-zinc-500">
          Example: {examples.map(([p, r]) => `a ₹${p.toLocaleString('en-IN')} piece → ${r}%`).join(', ')}.
          {inclusive && ' Limits are on the price before GST, so with 5% up to ₹2,500 a ₹2,625 tag is still 5%.'}
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          {dirty && <Button onClick={() => { setSlabs(saved.slabs); setInclusive(saved.inclusive); setError('') }}>Discard</Button>}
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>Save GST settings</Button>
        </div>
      </form>
    </Section>
  )
}
