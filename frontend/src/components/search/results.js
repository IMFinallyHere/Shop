import { Boxes, Receipt, Shirt, Truck, Undo2, Users } from 'lucide-react'
import { formatDate, money, moneyShort } from '../../utils/format'

export const UNIT_STATUS = {
  in_stock: { tone: 'success', label: 'In stock' },
  sold: { tone: 'brand', label: 'Sold' },
  removed: { tone: 'neutral', label: 'Removed' },
}

// How each result type is shown and where it leads. `target` is handled by useSearchNavigation.
export const GROUPS = [
  { key: 'units', label: 'Stock units', icon: Boxes, item: u => ({
    id: u.code, title: u.product_name, subtitle: [u.label, u.code].filter(Boolean).join(' · '),
    meta: moneyShort(u.price), status: u.status, target: { type: 'unit', code: u.code } }) },
  { key: 'bills', label: 'Bills', icon: Receipt, item: b => ({
    id: b.id, title: `${b.number} · ${b.customer_name || 'Walk-in'}`,
    subtitle: `${formatDate(b.created_at)} · ${b.items} item${b.items !== 1 ? 's' : ''}`,
    meta: money(b.total), target: { type: 'bill', id: b.id } }) },
  { key: 'returns', label: 'Returns', icon: Undo2, item: r => ({
    id: r.id, title: `${r.number} · ${r.customer_name || 'Walk-in'}`,
    subtitle: `From ${r.bill_number} · ${formatDate(r.created_at)} · ${r.mode === 'credit' ? 'Store credit' : 'Refund'}`,
    meta: money(r.amount), target: { type: 'return', id: r.id } }) },
  { key: 'customers', label: 'Customers', icon: Users, item: c => ({
    id: c.id, title: c.name, subtitle: c.phone, target: { type: 'customer', id: c.id } }) },
  { key: 'products', label: 'Products', icon: Shirt, item: p => ({
    id: p.id, title: p.name, subtitle: [p.category, `${p.in_stock} in stock`].filter(Boolean).join(' · '),
    target: { type: 'product', name: p.name } }) },
  { key: 'sellers', label: 'Sellers', icon: Truck, item: s => ({
    id: s.id, title: s.name, subtitle: [s.phone, `${s.products} product${s.products !== 1 ? 's' : ''}`].filter(Boolean).join(' · '),
    target: { type: 'seller', id: s.id, name: s.name } }) },
]

// Non-empty groups with their display items, in GROUPS order.
export const groupResults = (data) => GROUPS
  .map(g => ({ ...g, items: (data?.[g.key] ?? []).map(g.item) }))
  .filter(g => g.items.length > 0)

// Where a non-modal target navigates to (bills/returns open a receipt instead).
export const targetPath = (t) => ({
  unit: `/stock/${encodeURIComponent(t.code)}`,
  customer: `/customers/${t.id}`,
  product: `/products?q=${encodeURIComponent(t.name ?? '')}`,
  seller: `/products?seller=${t.id}&seller_name=${encodeURIComponent(t.name ?? '')}`,
})[t.type]
