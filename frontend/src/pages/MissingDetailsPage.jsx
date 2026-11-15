import { useEffect, useState } from 'react'
import { CheckCircle2, Save } from 'lucide-react'
import { getCategories, getIncompleteProducts, getSellers, updateProduct, updateProductBatches } from '../api/inventory'
import useQuery, { asList } from '../hooks/useQuery'
import { refreshMissingCount } from '../hooks/useMissingCount'
import usePrintSettings from '../hooks/usePrintSettings'
import ErrorAlert from '../components/common/ErrorAlert'
import QuickAddDialog from '../components/inventory/QuickAddDialog'
import EditProductModal from '../components/inventory/EditProductModal'
import PrintBarcodes from '../components/inventory/PrintBarcodes'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge, { Swatch } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import Spinner from '../components/common/Spinner'
import { Field, Input, Select } from '../components/ui/Field'
import { useToast } from '../components/ui/Toast'
import { productLabel } from '../utils/names'
import { variantLabel } from '../utils/variant'
import { moneyShort } from '../utils/format'

const LABEL = { name: 'Name', category: 'Category', seller: 'Seller', sku: 'SKU', cost_price: 'Cost price' }
const PAGE_SIZE = 20

// One incomplete product: inputs only for what is missing. Saving sends just those fields, so
// everything else on the product stays untouched. When it is complete the server stops listing it.
function MissingRow({ product, categories, sellers, hideName, onAskCreate, onSaved, onEdit }) {
  const toast = useToast()
  const missing = new Set(product.missing)
  const [values, setValues] = useState({ name: '', sku: '', category: '', seller: '' })
  const [costs, setCosts] = useState({})  // batch id → cost
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setValues(x => ({ ...x, [k]: v }))
  const touched = ['name', 'sku', 'category', 'seller'].filter(k => missing.has(k))
  const filled = (v) => String(v ?? '').trim() !== ''
  const ready = touched.every(k => filled(values[k]))
    && (!missing.has('cost_price') || product.batches_missing_cost.every(b => filled(costs[b.id])))

  const save = async () => {
    setSaving(true); setError(''); setErrors({})
    try {
      if (touched.length) {
        const body = {}
        touched.forEach(k => { body[k] = (k === 'category' || k === 'seller') ? Number(values[k]) : values[k].trim() })
        await updateProduct(product.id, body)
      }
      if (missing.has('cost_price')) {
        await updateProductBatches(product.id, product.batches_missing_cost.map(b => ({
          id: b.id, color: b.color, size: b.size, quantity: b.quantity, price: b.price, cost_price: costs[b.id],
        })))
      }
      toast('Details saved')
      onSaved()
    } catch (e) {
      const d = e.response?.data || {}
      const fields = {}
      touched.forEach(k => { if (d[k]) fields[k] = Array.isArray(d[k]) ? d[k][0] : d[k] })
      setErrors(fields)
      setError(d.detail || (Object.keys(fields).length ? '' : 'Could not save these details.'))
    } finally { setSaving(false) }
  }

  const select = (key, options, kind) => (
    <Field label={LABEL[key]} required error={errors[key]} className="min-w-0">
      {id => (
        <Select id={id} value={values[key]} onChange={e => set(key, e.target.value)} invalid={!!errors[key]}
          onCreate={async (name) => { const rid = await onAskCreate(kind)(name); if (rid) set(key, String(rid)); return rid }} createLabel={kind}>
          <option value="">— Select —</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      )}
    </Field>
  )
  const text = (key) => (
    <Field label={LABEL[key]} required error={errors[key]} className="min-w-0">
      {id => <Input id={id} value={values[key]} onChange={e => set(key, e.target.value)} invalid={!!errors[key]} placeholder="Required" />}
    </Field>
  )

  // A read-only value (not editable on this page).
  const fact = (label, value) => (
    <div className="min-w-0">
      <div className="mb-1 text-sm font-medium text-zinc-700">{label}</div>
      <div className="truncate text-sm text-zinc-900">{value || <span className="text-zinc-400">—</span>}</div>
    </div>
  )

  const title = hideName || !filled(product.name)
    ? productLabel({ id: product.id, fabric_type: product.fabric_type, category_name: product.category_name }) : product.name

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-zinc-900">{title}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="text-xs text-zinc-500">Missing:</span>
            {product.missing.map(k => <Badge key={k} tone="warning">{LABEL[k]}</Badge>)}
          </div>
        </div>
        <button type="button" onClick={() => onEdit(product)} className="text-xs font-medium text-brand-600 hover:underline">Open full edit</button>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError('')} />
      {/* Every detail of the product, for reference. Only the missing ones can be edited here. */}
      <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        {!hideName && (missing.has('name') ? text('name') : fact('Name', product.name))}
        {missing.has('category') ? select('category', categories, 'category') : fact('Category', product.category_name)}
        {missing.has('seller') ? select('seller', sellers, 'seller') : fact('Seller', product.seller_name)}
        {missing.has('sku') ? text('sku') : fact('SKU', product.sku)}
        {fact('Fabric', product.fabric_type)}
        {fact('In stock', `${product.stock_quantity} unit${product.stock_quantity !== 1 ? 's' : ''}`)}
        {fact('Price', product.price_min == null ? null : product.price_min === product.price_max ? moneyShort(product.price_min) : `${moneyShort(product.price_min)} – ${moneyShort(product.price_max)}`)}
        {fact('Type', product.is_one_time ? 'One-time stock' : 'Regular')}
      </div>
      {(product.variants ?? []).length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-medium text-zinc-500">Variants</div>
          <div className="flex flex-wrap gap-1.5">
            {product.variants.map(v => (
              <span key={v.id} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-700">
                <Swatch hex={v.color_hex} />{variantLabel(v) || 'Default'}
                <span className="text-zinc-400">·</span><span className="tabular-nums">{v.stock_quantity} in stock</span>
                {v.last_price != null && <><span className="text-zinc-400">·</span><span className="tabular-nums">{moneyShort(v.last_price)}</span></>}
              </span>
            ))}
          </div>
        </div>
      )}

      {missing.has('cost_price') && (
        <div className="mt-4">
          <div className="mb-1.5 text-sm font-medium text-zinc-700">Cost price <span className="text-red-500">*</span> <span className="font-normal text-zinc-500">for stock without one</span></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {product.batches_missing_cost.map(b => (
              <div key={b.id}>
                <label className="mb-1 block text-xs text-zinc-500">{variantLabel(b) || 'Default'} · {b.quantity} in stock · sells ₹{Number(b.price)}</label>
                <Input type="number" min="0" step="0.01" placeholder="Cost ₹" value={costs[b.id] ?? ''} onChange={e => setCosts(c => ({ ...c, [b.id]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button variant="primary" size="sm" icon={Save} onClick={save} loading={saving} disabled={!ready}>Save details</Button>
      </div>
    </Card>
  )
}

export default function MissingDetailsPage() {
  const hideName = !!usePrintSettings().hide_product_name
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useQuery(() => getIncompleteProducts({ page }), String(page))
  const { rows, count } = asList(data)
  const [categories, setCategories] = useState([])
  const [sellers, setSellers] = useState([])
  const [quick, setQuick] = useState(null)
  const [editing, setEditing] = useState(null)
  const [printItems, setPrintItems] = useState(null)
  const askCreate = (kind) => (name) => new Promise(resolve => setQuick({ kind, name, resolve }))

  useEffect(() => {
    getCategories({ all: 1 }).then(r => setCategories(r.data.results ?? r.data)).catch(() => {})
    getSellers({ all: 1 }).then(r => setSellers(r.data.results ?? r.data)).catch(() => {})
  }, [])

  // Saving the last product on a page steps back to the previous page.
  const saved = () => { if (rows.length === 1 && page > 1) setPage(p => p - 1); else reload(); refreshMissingCount() }
  const quickDone = (record) => {
    (quick.kind === 'seller' ? setSellers : setCategories)(l => [...l, record].sort((a, b) => a.name.localeCompare(b.name)))
    quick.resolve(record.id); setQuick(null)
  }

  return (
    <div>
      <PageHeader title="Missing details"
        subtitle="Products that are missing something this shop now requires. Fill it in here and the product leaves this list." />
      <ErrorAlert message={error && 'Failed to load products.'} />
      {loading ? <Spinner /> : rows.length === 0 ? (
        <Card><EmptyState icon={CheckCircle2} title="Nothing missing" description="Every active product has the details your Settings require." /></Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">{count} product{count !== 1 ? 's' : ''} need details.</p>
          {rows.map(p => (
            <MissingRow key={p.id} product={p} categories={categories} sellers={sellers} hideName={hideName} onAskCreate={askCreate} onSaved={saved} onEdit={setEditing} />
          ))}
          <Pagination page={page} pageSize={PAGE_SIZE} count={count} onChange={setPage} />
        </div>
      )}
      <EditProductModal product={editing} onClose={() => setEditing(null)}
        onSaved={(units) => { saved(); if (units.length) setPrintItems(units) }} />
      <PrintBarcodes items={printItems} title="Barcodes" onClose={() => setPrintItems(null)} />
      {quick && <QuickAddDialog kind={quick.kind} initialName={quick.name} onCreated={quickDone} onClose={() => { quick.resolve(null); setQuick(null) }} />}
    </div>
  )
}
