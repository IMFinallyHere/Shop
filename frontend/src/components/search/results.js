import { Boxes, Receipt, Shirt, Truck, Undo2, Users } from 'lucide-react'
import { formatDate, money, moneyShort } from '../../utils/format'
import { productLabel, unitTitle } from '../../utils/names'

export const UNIT_STATUS = {
  in_stock: { tone: 'success', label: 'In stock' },
  sold: { tone: 'brand', label: 'Sold' },
  removed: { tone: 'neutral', label: 'Removed' },
}

// How each result type is shown and where it leads. `target` is handled by useSearchNavigation.
export const GROUPS = [
  { key: 'units', label: 'Stock units', icon: Boxes, item: (u, hide) => ({
    id: u.code, title: unitTitle(u.product_name, u.code, hide),
    subtitle: (hide ? [u.label] : [u.label, u.code]).filter(Boolean).join(' · '),
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
  { key: 'products', label: 'Products', icon: Shirt, item: (p, hide) => ({
    id: p.id, title: hide ? productLabel({ id: p.id, category_name: p.category }) : p.name,
    subtitle: [p.category, `${p.in_stock} in stock`].filter(Boolean).join(' · '),
    target: { type: 'product', id: p.id } }) },
  { key: 'sellers', label: 'Sellers', icon: Truck, item: s => ({
    id: s.id, title: s.name, subtitle: [(s.phones ?? [s.phone]).filter(Boolean).join(', '), `${s.products} product${s.products !== 1 ? 's' : ''}`].filter(Boolean).join(' · '),
    target: { type: 'seller', id: s.id, name: s.name } }) },
]

// Non-empty groups with their display items, in GROUPS order.
export const groupResults = (data, hide = false) => GROUPS
  .map(g => ({ ...g, items: (data?.[g.key] ?? []).map(x => g.item(x, hide)) }))
  .filter(g => g.items.length > 0)

// Where a non-modal target navigates to (bills/returns open a receipt instead).
export const targetPath = (t) => ({
  unit: `/stock/${encodeURIComponent(t.code)}`,
  customer: `/customers/${t.id}`,
  product: `/products?product=${t.id}`,  // by id, so a hidden name never lands in the URL
  seller: `/products?seller=${t.id}&seller_name=${encodeURIComponent(t.name ?? '')}`,
})[t.type]
