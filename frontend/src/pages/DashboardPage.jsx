import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, IndianRupee, PackagePlus, Receipt, ScanBarcode, ShoppingBag, Undo2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getDashboard } from '../api/dashboard'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardHeader } from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import Button from '../components/ui/Button'
import Badge, { Swatch } from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import ErrorAlert from '../components/common/ErrorAlert'
import SalesChart from '../components/dashboard/SalesChart'
import { formatDateTime, money, moneyShort } from '../utils/format'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getDashboard().then(r => setData(r.data)).catch(() => setError('Failed to load dashboard.'))
  }, [])

  const t = data?.today
  const loading = !data && !error
  const weekTotal = data?.last_7_days.reduce((s, d) => s + Number(d.total), 0) ?? 0

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            {greeting()}{user?.first_name ? `, ${user.first_name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · here's how {user?.shop_name || 'your shop'} is doing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as={Link} to="/returns" icon={Undo2}>Return</Button>
          <Button as={Link} to="/products" icon={PackagePlus}>Add stock</Button>
          <Button as={Link} to="/pos" variant="primary" icon={ScanBarcode}>New bill</Button>
        </div>
      </div>

      <ErrorAlert message={error} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sales today" icon={IndianRupee} loading={loading} value={moneyShort(t?.sales)} hint={t && `${t.items_sold} item${t.items_sold !== 1 ? 's' : ''} sold`} />
        <StatCard label="Bills today" icon={Receipt} loading={loading} value={t?.bills} />
        <StatCard label="Average bill" icon={ShoppingBag} loading={loading} value={t && money(t.avg_bill)} />
        <StatCard label="Refunds today" icon={Undo2} loading={loading} value={moneyShort(t?.refunds)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="flex flex-col lg:col-span-3">
          <CardHeader title="Sales, last 7 days" subtitle={data ? `${money(weekTotal)} total` : ' '} />
          {/* The chart grows to the card's height (set by the Low stock card beside it). */}
          <div className="flex flex-1 flex-col px-5 pb-4 pt-6">
            {data ? <SalesChart days={data.last_7_days} /> : <div className="min-h-[200px] flex-1 animate-pulse rounded-lg bg-zinc-50" />}
          </div>
        </Card>

        <Card className="flex flex-col lg:col-span-2">
          <CardHeader
            title="Low stock"
            subtitle={data && (data.low_stock_count ? `${data.low_stock_count} variant${data.low_stock_count !== 1 ? 's' : ''} at or below threshold` : 'All variants above threshold')}
            action={data?.low_stock_count > 0 && <Button as={Link} to="/products?low=1" variant="ghost" size="xs">View all <ArrowRight size={14} /></Button>}
          />
          {data && data.low_stock.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Stock looks healthy" description="Nothing needs restocking right now." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(data?.low_stock ?? Array.from({ length: 4 }, () => null)).map((v, i) => (
                <li key={v?.variant_id ?? i} className="flex items-center gap-3 px-5 py-2.5">
                  {v ? (<>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-800">{v.product_name}</div>
                      {v.label && <div className="flex items-center gap-1.5 text-xs text-zinc-500"><Swatch hex={v.color_hex} />{v.label}</div>}
                    </div>
                    <Badge tone={v.stock === 0 ? 'danger' : 'warning'}>
                      {v.stock === 0 ? 'Out of stock' : `${v.stock} left`}
                    </Badge>
                  </>) : <div className="h-8 w-full animate-pulse rounded bg-zinc-50" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Recent bills" action={<Button as={Link} to="/sales" variant="ghost" size="xs">All sales <ArrowRight size={14} /></Button>} />
          {data && data.recent_bills.length === 0 ? (
            <EmptyState icon={Receipt} title="No bills yet" description="Bills you create at the counter will show up here."
              action={<Button as={Link} to="/pos" variant="primary" icon={ScanBarcode}>Create first bill</Button>} />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(data?.recent_bills ?? Array.from({ length: 3 }, () => null)).map((b, i) => (
                <li key={b?.id ?? i} className="flex items-center gap-4 px-5 py-3">
                  {b ? (<>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><Receipt size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-800">{b.customer_name || 'Walk-in'}</div>
                      <div className="text-xs text-zinc-500">{b.number} · {formatDateTime(b.created_at)}</div>
                    </div>
                    <Badge className="hidden sm:inline-flex">{b.payment_mode}</Badge>
                    <div className="w-24 text-right text-sm font-semibold tabular-nums text-zinc-900">{money(b.total)}</div>
                  </>) : <div className="h-9 w-full animate-pulse rounded bg-zinc-50" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Recent returns" action={<Button as={Link} to="/returns" variant="ghost" size="xs">All returns <ArrowRight size={14} /></Button>} />
          {data && data.recent_returns.length === 0 ? (
            <EmptyState icon={Undo2} title="No returns yet" description="Refunds and store-credit returns will show up here." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(data?.recent_returns ?? Array.from({ length: 3 }, () => null)).map((r, i) => (
                <li key={r?.id ?? i} className="flex items-center gap-3 px-5 py-3">
                  {r ? (<>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600"><Undo2 size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-800">{r.customer_name || 'Walk-in'}</div>
                      <div className="truncate text-xs text-zinc-500">{r.number} · from {r.bill_number} · {formatDateTime(r.created_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums text-zinc-900">{money(r.amount)}</div>
                      <div className="text-xs text-zinc-500">{r.mode === 'credit' ? 'Store credit' : r.payment_mode}</div>
                    </div>
                  </>) : <div className="h-9 w-full animate-pulse rounded bg-zinc-50" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {data?.low_stock_count > 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
          <AlertTriangle size={13} /> Low-stock thresholds can be changed per variant from Products → Variants.
        </p>
      )}
    </div>
  )
}
