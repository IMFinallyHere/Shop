import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowLeft, Boxes, Download, Mail, MapPin, PackagePlus, Phone, Printer, Receipt, Shirt, Trash2, Truck, Undo2, UserRound, Wallet,
} from 'lucide-react'
import { getUnitHistory } from '../api/search'
import useQuery from '../hooks/useQuery'
import useReceipts from '../hooks/useReceipts'
import BarcodeLabel from '../components/inventory/BarcodeLabel'
import PrintBarcodes from '../components/inventory/PrintBarcodes'
import Spinner from '../components/common/Spinner'
import Button from '../components/ui/Button'
import Badge, { Swatch } from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { UNIT_STATUS } from '../components/search/results'
import { downloadCode128 } from '../utils/barcode'
import { formatDate, formatDateTime, initials, money } from '../utils/format'

function Detail({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-900">{children ?? '—'}</dd>
    </div>
  )
}

const EVENT = {
  added: { icon: PackagePlus, tone: 'bg-zinc-100 text-zinc-600' },
  sold: { icon: Receipt, tone: 'bg-brand-50 text-brand-600' },
  returned: { icon: Undo2, tone: 'bg-amber-50 text-amber-600' },
  removed: { icon: Trash2, tone: 'bg-red-50 text-red-600' },
}

export default function StockUnitPage() {
  const { code } = useParams()
  const { data, loading, error } = useQuery(() => getUnitHistory(code), code)
  const { openBill, openReturn, receipts } = useReceipts()
  const [printing, setPrinting] = useState(false)

  if (loading) return <Spinner />
  if (error) {
    return (
      <Card>
        <EmptyState icon={Boxes} title={`No stock unit “${code}”`} description="Check the code, or search for the product instead."
          action={<Button as={Link} to="/stock" icon={ArrowLeft}>Back to stock</Button>} />
      </Card>
    )
  }

  const { unit, product, variant, batch, seller, timeline, customers } = data
  const status = UNIT_STATUS[unit.status]
  const label = { code: unit.code, product_name: product.name, color_name: variant.color_name, size_name: variant.size_name, price: batch.price }

  return (
    <div>
      <Link to="/stock" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"><ArrowLeft size={14} /> Stock</Link>

      <Card className="mb-6 flex flex-wrap items-center gap-5 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{product.name}</h1>
            <Badge tone={status?.tone} dot>{status?.label ?? unit.status}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
            {variant.label && <span className="flex items-center gap-1.5"><Swatch hex={variant.color_hex} />{variant.label}</span>}
            <span className="font-mono">{unit.code}</span>
            <span>Selling at <span className="font-medium text-zinc-800">{money(batch.price)}</span></span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" icon={Printer} onClick={() => setPrinting(true)}>Print label</Button>
            <Button size="sm" icon={Download} onClick={() => downloadCode128(label)}>Download barcode</Button>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-white p-2"><BarcodeLabel code={unit.code} /></div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="self-start">
          <CardHeader title="History" subtitle="Everything that happened to this piece, oldest first." />
          <ol className="p-5">
            {timeline.map((e, i) => {
              const { icon: Icon, tone } = EVENT[e.type]
              const last = i === timeline.length - 1
              return (
                <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && <span className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-zinc-200" />}
                  <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', tone)}><Icon size={15} /></span>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-sm font-medium text-zinc-900">
                        {e.type === 'added' && `Added to stock (batch of ${e.batch_quantity})`}
                        {e.type === 'sold' && <>Sold on <button onClick={() => openBill(e.bill_id)} className="text-brand-600 hover:underline">{e.bill_number}</button></>}
                        {e.type === 'returned' && <>Returned · <button onClick={() => openReturn(e.return_id)} className="text-brand-600 hover:underline">{e.return_number}</button></>}
                        {e.type === 'removed' && 'Removed from stock'}
                      </span>
                      <span className="text-xs text-zinc-500">{e.at ? formatDateTime(e.at) : 'Date not recorded'}</span>
                    </div>
                    <div className="mt-0.5 text-sm text-zinc-500">
                      {e.type === 'added' && <>Cost {money(e.cost_price)} · Price {money(e.price)}</>}
                      {e.type === 'sold' && <>
                        {money(e.price)} via {e.payment_mode} to{' '}
                        {e.customer_id
                          ? <Link to={`/customers/${e.customer_id}`} className="font-medium text-zinc-700 hover:underline">{e.customer_name}</Link>
                          : <span className="font-medium text-zinc-700">{e.customer_name || 'walk-in'}</span>}
                        {e.customer_phone && ` (${e.customer_phone})`}
                        {e.by && <span className="block text-xs text-zinc-400">Billed by {e.by}</span>}
                      </>}
                      {e.type === 'returned' && <>
                        {money(e.refund)} {e.mode === 'credit' ? 'added as store credit' : `refunded via ${e.payment_mode}`} · back in stock
                        {e.reason && <span className="block italic">“{e.reason}”</span>}
                      </>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Product" action={<Button as={Link} to={`/products?q=${encodeURIComponent(product.name)}`} variant="ghost" size="xs" icon={Shirt}>Open</Button>} />
            <dl className="px-5 py-3">
              <Detail label="Category">{product.category}</Detail>
              <Detail label="Fabric">{product.fabric_type || null}</Detail>
              {product.sku && <Detail label="SKU">{product.sku}</Detail>}
              <Detail label="Color / size">{variant.label || 'Default'}</Detail>
              <Detail label="This variant in stock">
                <Badge tone={variant.in_stock === 0 ? 'danger' : variant.in_stock <= variant.low_stock_threshold ? 'warning' : 'success'}>{variant.in_stock}</Badge>
              </Detail>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Batch" subtitle={`Added ${formatDate(batch.created_at)}`} />
            <dl className="px-5 py-3">
              <Detail label="Cost price">{money(batch.cost_price)}</Detail>
              <Detail label="Selling price">{money(batch.price)}</Detail>
              <Detail label="Margin">{money(batch.margin)}</Detail>
              <Detail label="Units in batch">{batch.quantity}</Detail>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Seller" action={seller && <Button as={Link} to={`/products?seller=${seller.id}&seller_name=${encodeURIComponent(seller.name)}`} variant="ghost" size="xs" icon={Truck}>Products</Button>} />
            {seller ? (
              <div className="space-y-1.5 px-5 py-4 text-sm">
                <div className="font-medium text-zinc-900">{seller.name}</div>
                {seller.phone && <div className="flex items-center gap-2 text-zinc-600"><Phone size={14} className="text-zinc-400" />{seller.phone}</div>}
                {seller.email && <div className="flex items-center gap-2 text-zinc-600"><Mail size={14} className="text-zinc-400" />{seller.email}</div>}
                {seller.address && <div className="flex items-center gap-2 text-zinc-600"><MapPin size={14} className="text-zinc-400" />{seller.address}</div>}
              </div>
            ) : <p className="px-5 py-4 text-sm text-zinc-500">No seller set on this product.</p>}
          </Card>

          <Card>
            <CardHeader title={customers.length > 1 ? 'Customers' : 'Customer'} />
            {customers.length === 0 ? <p className="px-5 py-4 text-sm text-zinc-500">Not sold yet.</p> : (
              <ul className="divide-y divide-zinc-100">
                {customers.map(c => (
                  <li key={c.id}>
                    <Link to={`/customers/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{initials(c.name) || <UserRound size={15} />}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-zinc-900">{c.name}</div>
                        <div className="text-xs text-zinc-500">{c.phone} · {c.bills} bill{c.bills !== 1 ? 's' : ''}</div>
                      </div>
                      {Number(c.credit_balance) > 0 && <Badge tone="success"><Wallet size={11} />{money(c.credit_balance)}</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <PrintBarcodes items={printing ? [label] : null} title={`Label — ${product.name}`} onClose={() => setPrinting(false)} />
      {receipts}
    </div>
  )
}
