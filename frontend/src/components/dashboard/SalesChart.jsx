import { useState } from 'react'
import clsx from 'clsx'
import { money, moneyShort } from '../../utils/format'

const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })
const fullDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })

// Round the axis max up to a clean number (1, 2, 2.5, 5 × 10^n).
const niceMax = (v) => {
  if (v <= 0) return 1000
  const p = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(m => m >= v)
}

// Single-series column chart of the last 7 days' sales. Today's column is labeled;
// every column has a hover tooltip; an sr-only table carries the numbers.
export default function SalesChart({ days }) {
  const [hover, setHover] = useState(null)
  const max = niceMax(Math.max(...days.map(d => Number(d.total))))
  const H = 160

  return (
    <div>
      <div className="relative flex" style={{ height: H + 24 }}>
        {/* y-axis: 0 and max, recessive */}
        <div className="flex w-14 shrink-0 flex-col justify-between pb-6 pr-2 text-right text-[11px] tabular-nums text-zinc-400">
          <span className="-translate-y-1/2">{moneyShort(max)}</span>
          <span className="translate-y-1/2">₹0</span>
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 border-t border-zinc-100" />
          <div className="absolute inset-x-0 top-1/2 border-t border-zinc-100" />
          <div className="absolute inset-x-0 border-t border-zinc-200" style={{ top: H }} />
          <div className="absolute inset-x-0 top-0 flex" style={{ height: H }}>
            {days.map((d, i) => {
              const h = Math.max((Number(d.total) / max) * H, Number(d.total) > 0 ? 3 : 0)
              const isToday = i === days.length - 1
              return (
                <div
                  key={d.date}
                  className="relative flex flex-1 cursor-default flex-col items-center justify-end"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {isToday && Number(d.total) > 0 && hover == null && (
                    <span className="mb-1 text-[11px] font-medium tabular-nums text-zinc-700">{moneyShort(d.total)}</span>
                  )}
                  <div
                    className={clsx('w-full max-w-[24px] rounded-t-[4px] transition-colors',
                      hover === i ? 'bg-brand-600' : isToday ? 'bg-brand-500' : 'bg-brand-500/70')}
                    style={{ height: h }}
                  />
                  {hover === i && (
                    <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-max animate-fade-in rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-pop"
                      style={{ bottom: h + 8 }}>
                      <div className="text-zinc-500">{fullDate(d.date)}</div>
                      <div className="mt-0.5 font-semibold tabular-nums text-zinc-900">{money(d.total)}</div>
                      <div className="text-zinc-500">{d.count} bill{d.count !== 1 ? 's' : ''}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="absolute inset-x-0 flex" style={{ top: H + 6 }}>
            {days.map((d, i) => (
              <span key={d.date} className={clsx('flex-1 text-center text-[11px]', i === days.length - 1 ? 'font-medium text-zinc-700' : 'text-zinc-400')}>
                {i === days.length - 1 ? 'Today' : dayLabel(d.date)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>Sales, last 7 days</caption>
        <thead><tr><th>Date</th><th>Sales</th><th>Bills</th></tr></thead>
        <tbody>{days.map(d => <tr key={d.date}><td>{d.date}</td><td>{money(d.total)}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
    </div>
  )
}
