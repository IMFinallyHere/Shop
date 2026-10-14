import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { drawCode128Svg } from '../../utils/barcode'
import { prefersReducedMotion, useCountUp } from './motion'

// Three pieces from the demo shop, scanned one after another.
const ITEMS = [
  { name: 'Banarasi Silk Saree', variant: 'Maroon, free size', price: 8499, code: '7F3A9C21B04E' },
  { name: 'Chikankari Kurta', variant: 'White, M', price: 1299, code: '2C81D0E5A913' },
  { name: 'Kids Kurta Pyjama Set', variant: 'Mustard, S', price: 799, code: '9B44E1F07C2D' },
]
const inr = (n) => `₹${n.toLocaleString('en-IN')}`

// The hero: a tag is scanned, the piece drops into the bill, the total counts up,
// and after three pieces the bill is charged. Then it starts over.
export default function LiveCounter() {
  const reduced = prefersReducedMotion()
  const [current, setCurrent] = useState(reduced ? 2 : 0)
  const [rows, setRows] = useState(reduced ? ITEMS.length : 0)
  const [phase, setPhase] = useState(reduced ? 'paid' : 'scan')
  const [beam, setBeam] = useState(0)
  const svgRef = useRef(null)
  const item = ITEMS[current]
  const total = useCountUp(ITEMS.slice(0, rows).reduce((s, i) => s + i.price, 0))

  useEffect(() => { if (svgRef.current) drawCode128Svg(svgRef.current, item.code) }, [item.code])

  useEffect(() => {
    if (reduced) return
    const steps = [[0, () => { setRows(0); setPhase('scan'); setCurrent(0) }]]
    ITEMS.forEach((_, i) => {
      const t = 600 + i * 1900
      steps.push([t, () => { setCurrent(i); setBeam(b => b + 1) }])
      steps.push([t + 1000, () => setRows(i + 1)])
    })
    const end = 600 + ITEMS.length * 1900
    steps.push([end + 200, () => setPhase('charge')], [end + 1300, () => setPhase('paid')])
    const timers = steps.map(([t, fn]) => setTimeout(fn, t))
    const loop = setInterval(() => steps.forEach(([t, fn]) => timers.push(setTimeout(fn, t))), end + 4200)
    return () => { timers.forEach(clearTimeout); clearInterval(loop) }
  }, [reduced])

  return (
    <div className="relative mx-auto h-[29rem] w-full max-w-[31rem] sm:h-[30rem]" role="img"
      aria-label="A saree, a kurta and a kids' set are scanned into a bill that totals ₹10,597 and is paid by UPI">
      <div className="lp-glow absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-marigold-400/25 blur-3xl" aria-hidden="true" />

      {/* The tag being scanned. */}
      <div className="lp-bob absolute left-3 top-2 w-[12.5rem] sm:left-0 sm:top-4 sm:w-[15rem]" aria-hidden="true">
        <div className="rounded-[22px] bg-white p-5 pt-9 text-dye-950 shadow-[0_30px_60px_-20px_rgba(0,0,0,.6)]">
          <span className="absolute left-1/2 top-3.5 h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-marigold-400 bg-dye-900" />
          <div key={current} className="lp-swap">
            <p className="font-display text-xl font-bold leading-tight tracking-tight">{item.name}</p>
            <p className="mt-0.5 text-sm text-zinc-500">{item.variant}</p>
            <p className="mt-3 font-display text-3xl font-bold tracking-tight">{inr(item.price)}</p>
          </div>
          <div className="relative mt-4 h-14">
            <svg ref={svgRef} className="block h-full w-full" />
            <span key={beam} className="lp-beam" data-on={beam ? '' : undefined} />
          </div>
          <p className="mt-1.5 text-center text-[10px] tracking-[0.3em] text-zinc-400">{item.code}</p>
        </div>
      </div>

      {/* The bill filling up. */}
      <div className="absolute bottom-0 right-0 w-[15.5rem] rounded-2xl bg-white p-5 text-dye-950 shadow-[0_40px_80px_-24px_rgba(0,0,0,.65)] sm:w-[19rem]" aria-hidden="true">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-lg font-bold tracking-tight">New bill</p>
          <p className="text-xs text-zinc-500">Asha Boutique</p>
        </div>
        <ul className="mt-3 min-h-[8.25rem] space-y-1">
          {ITEMS.slice(0, rows).map(it => (
            <li key={it.code} className="lp-row flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 text-sm">
              <span className="min-w-0"><span className="block truncate font-medium">{it.name}</span><span className="text-xs text-zinc-500">{it.variant}</span></span>
              <span className="shrink-0 font-medium tabular-nums">{inr(it.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-zinc-300 px-2 pt-3">
          <span className="text-sm text-zinc-500">Total</span>
          <span className="font-display text-2xl font-bold tabular-nums tracking-tight">{inr(total)}</span>
        </div>
        <div className="mt-4 h-11">
          {phase === 'paid' ? (
            <div key="paid" className="lp-pop flex h-full items-center justify-center gap-2 rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700">
              <Check size={18} strokeWidth={2.5} /> Paid via UPI
            </div>
          ) : (
            <div className={`flex h-full items-center justify-center rounded-xl text-sm font-semibold text-white transition-all duration-300 ${phase === 'charge' ? 'scale-[1.03] bg-dye-900 ring-4 ring-marigold-400/60' : 'bg-dye-700/90'}`}>
              {rows ? `Charge ${inr(total)}` : 'Scan a piece to start'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
