import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Layers, PackagePlus, Pencil, Plus, Shirt, Trash2, Truck, X } from 'lucide-react'
import {
  getProducts, createProduct, updateProduct, deleteProduct, addStock,
  updateVariant, deleteVariant, getCategories, getSellers,
} from '../api/inventory'
import { getColors, getSizes } from '../api/shopsettings'
import useQuery, { asList } from '../hooks/useQuery'
import ActionMenu from '../components/common/ActionMenu'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import ProductForm from '../components/forms/ProductForm'
import PrintBarcodes from '../components/inventory/PrintBarcodes'
import AddStockLines from '../components/inventory/AddStockLines'
import VariantList from '../components/inventory/VariantList'
import SearchInput from '../components/common/SearchInput'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader, { Toolbar } from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge, { Swatch } from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import SegmentedControl from '../components/ui/SegmentedControl'
import { Table, Td, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'
import { EMPTY_LINE, variantLabel } from '../utils/variant'
import { moneyShort } from '../utils/format'

const EMPTY = { name: '', sku: '', category: '', seller: '', fabric_type: '' }
const KNOWN = ['name', 'sku', 'category', 'seller', 'fabric_type']
const PAGE_SIZE = 20

export default function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const lowOnly = params.get('low') === '1'
  const sellerId = params.get('seller')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [modal, setModal] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [formData, setFormData] = useState(EMPTY)
  const [categories, setCategories] = useState([])
  const [sellers, setSellers] = useState([])
  const [lines, setLines] = useState([{ ...EMPTY_LINE }])
  const [lineErrors, setLineErrors] = useState([])
  const [colors, setColors] = useState([])
  const [sizes, setSizes] = useState([])
  const [printItems, setPrintItems] = useState(null)
  const toast = useToast()

  const { data, loading, error: loadError, reload } = useQuery(
    () => getProducts({ page, search, ...(lowOnly ? { low_stock: 1 } : {}), ...(sellerId ? { seller: sellerId } : {}) }),
    `${page}|${search}|${lowOnly}|${sellerId}`,
  )
  const { rows: products, count } = asList(data)
  // Look the selected product up in the latest list so modals stay in sync after reloads.
  const [snapshot, setSnapshot] = useState(null)
  const selected = products.find(p => p.id === selectedId) ?? snapshot

  useEffect(() => {
    getCategories().then(r => setCategories(r.data.results ?? r.data))
    getSellers().then(r => setSellers(r.data.results ?? r.data))
  }, [])

  // Filters live in the URL (dashboard and search link here with ?low=1, ?q=, ?seller=).
  const setParam = (key, value) => {
    setParams(p => { const next = new URLSearchParams(p); value ? next.set(key, value) : next.delete(key); return next })
    setPage(1)
  }
  const setLowOnly = (v) => setParam('low', v ? '1' : null)
  const clearSeller = () => setParams(p => { const next = new URLSearchParams(p); next.delete('seller'); next.delete('seller_name'); return next })
  const select = (p) => { setSelectedId(p.id); setSnapshot(p) }

  const clean = (d) => {
    const out = { ...d }
    if (out.category === '') out.category = null
    if (out.seller === '') out.seller = null
    return out
  }

  const openCreate = () => { setFormData({ ...EMPTY }); setFieldErrors({}); setModal('create') }
  const openEdit = (p) => {
    select(p)
    setFormData({ name: p.name, sku: p.sku, category: p.category ?? '', seller: p.seller ?? '', fabric_type: p.fabric_type })
    setFieldErrors({}); setModal('edit')
  }
  const openDelete = (p) => { select(p); setModal('delete') }
  const openAddStock = (p) => {
    select(p); setLines([{ ...EMPTY_LINE }]); setLineErrors([]); setError(''); setModal('addstock')
    // Fetched on open so colors/sizes just added in Settings show up.
    getColors({ active: 1 }).then(r => setColors(r.data)).catch(() => setError('Failed to load colors.'))
    getSizes({ active: 1 }).then(r => setSizes(r.data)).catch(() => setError('Failed to load sizes.'))
  }
  const openVariants = (p) => { select(p); setError(''); setModal('variants') }
  const closeModal = () => { setModal(null); setSelectedId(null); setSnapshot(null); setError(''); setFieldErrors({}) }

  const parseErrors = (resp) => {
    const fields = {}; let general = ''
    Object.entries(resp || {}).forEach(([k, v]) => {
      const msg = Array.isArray(v) ? v[0] : v
      if (KNOWN.includes(k)) fields[k] = msg; else general += (general ? ' ' : '') + msg
    })
    return { fields, general }
  }

  const save = async (fn, message) => {
    setSaving(true); setError(''); setFieldErrors({})
    try { await fn(); reload(); closeModal(); toast(message) }
    catch (e) {
      const { fields, general } = parseErrors(e.response?.data)
      setFieldErrors(fields)
      setError(general || (Object.keys(fields).length ? '' : 'Something went wrong.'))
    } finally { setSaving(false) }
  }

  const handleCreate = () => save(() => createProduct(clean(formData)), 'Product created')
  const handleEdit = () => save(() => updateProduct(selected.id, clean(formData)), 'Product updated')

  const handleDelete = async () => {
    setSaving(true)
    try { await deleteProduct(selected.id); reload(); closeModal(); toast('Product deleted') }
    catch (e) { setError(e.response?.data?.detail || 'Failed to delete.') }
    finally { setSaving(false) }
  }

  const handleAddStock = async () => {
    setSaving(true); setError(''); setLineErrors([])
    try {
      const payload = lines.map(l => ({ ...l, color: l.color || null, size: l.size || null }))
      const { data } = await addStock(selected.id, payload)
      reload(); closeModal()
      toast(`${data.items.length} unit${data.items.length !== 1 ? 's' : ''} added`)
      setPrintItems(data.items)  // open the print view for everything just added
    } catch (e) {
      const errs = e.response?.data?.lines
      if (Array.isArray(errs) && typeof errs[0] === 'object') {
        // Per-line field errors: [{ quantity: ['…'] }, {}, …]
        setLineErrors(errs.map(le => Object.fromEntries(Object.entries(le || {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))))
      } else {
        setError((Array.isArray(errs) ? errs[0] : errs) || e.response?.data?.detail || 'Failed to add stock.')
      }
    } finally { setSaving(false) }
  }

  const handleThreshold = async (v, value) => {
    try { await updateVariant(v.id, { low_stock_threshold: value }); reload() }
    catch (e) { setError(e.response?.data?.low_stock_threshold?.[0] || 'Failed to update threshold.') }
  }

  const handleDeleteVariant = async (v) => {
    setError('')
    try { await deleteVariant(v.id); reload(); toast('Variant deleted') }
    catch (e) { setError(e.response?.data?.detail || 'Failed to delete variant.') }
  }

  const linesValid = lines.length > 0 && lines.every(l => Number(l.quantity) >= 1 && l.cost_price !== '' && l.price !== '')
  const totalUnits = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)

  const priceRange = (p) => p.price_min == null ? '—'
    : p.price_min === p.price_max ? moneyShort(p.price_min) : `${moneyShort(p.price_min)} – ${moneyShort(p.price_max)}`

  const formFooter = (onSave, label) => <>
    <Button onClick={closeModal}>Cancel</Button>
    <Button variant="primary" onClick={onSave} loading={saving}>{label}</Button>
  </>

  return (
    <div>
      <PageHeader title="Products" subtitle="Your catalogue, with stock across all colors and sizes."
        actions={<Button variant="primary" icon={Plus} onClick={openCreate}>New product</Button>} />

      <Toolbar>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search products…" />
        <SegmentedControl options={[{ value: false, label: 'All' }, { value: true, label: 'Low stock' }]} value={lowOnly} onChange={setLowOnly} />
        {sellerId && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-sm text-brand-700 ring-1 ring-inset ring-brand-200">
            <Truck size={14} /> {params.get('seller_name') || 'Seller'}
            <button onClick={clearSeller} className="rounded-full p-0.5 hover:bg-brand-100" aria-label="Clear seller filter"><X size={14} /></button>
          </span>
        )}
      </Toolbar>

      <ErrorAlert message={(!modal && error) || (loadError && 'Failed to load products.')} onDismiss={() => setError('')} />

      <Table
        columns={[{ label: 'Product' }, { label: 'Variants' }, { label: 'Category' }, { label: 'Price' }, { label: 'In stock' }, { label: '', className: 'w-12' }]}
        loading={loading} isEmpty={products.length === 0}
        empty={lowOnly
          ? { icon: Shirt, title: 'Nothing is low on stock', description: 'Every variant is above its low-stock threshold.' }
          : { icon: Shirt, title: search ? 'No matching products' : 'No products yet', description: search ? 'Try a different search.' : 'Create a product, then add stock to print barcodes.',
              action: !search && <Button variant="primary" icon={Plus} onClick={openCreate}>New product</Button> }}
      >
        {products.map(p => (
          <Tr key={p.id}>
            <Td>
              <div className="font-medium text-zinc-900">{p.name}</div>
              <div className="text-xs text-zinc-500">{[p.fabric_type, p.sku, p.seller_name].filter(Boolean).join(' · ') || '—'}</div>
            </Td>
            <Td>
              {p.variants.length ? (
                <div className="flex max-w-xs flex-wrap gap-1">
                  {p.variants.slice(0, 4).map(v => (
                    <span key={v.id} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs ring-1 ring-inset ${v.is_low_stock ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-zinc-50 text-zinc-600 ring-zinc-200'}`}>
                      <Swatch hex={v.color_hex} className="h-2.5 w-2.5" />
                      {variantLabel(v) || 'Default'} <span className="tabular-nums text-zinc-400">{v.stock_quantity}</span>
                    </span>
                  ))}
                  {p.variants.length > 4 && (
                    <button onClick={() => openVariants(p)} className="rounded-md px-1.5 py-0.5 text-xs text-brand-600 hover:bg-brand-50">+{p.variants.length - 4} more</button>
                  )}
                </div>
              ) : <span className="text-xs text-zinc-400">No stock yet</span>}
            </Td>
            <Td className="text-zinc-500">{p.category_name || '—'}</Td>
            <Td className="whitespace-nowrap tabular-nums">{priceRange(p)}</Td>
            <Td>
              <Badge tone={p.stock_quantity === 0 ? 'danger' : p.is_low_stock ? 'warning' : 'success'} dot>
                {p.stock_quantity}{p.is_low_stock && p.stock_quantity > 0 ? ' · low' : ''}
              </Badge>
            </Td>
            <Td className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="xs" icon={PackagePlus} onClick={() => openAddStock(p)} className="hidden md:inline-flex">Add stock</Button>
                <ActionMenu actions={[
                  { label: 'Add stock', icon: PackagePlus, onClick: () => openAddStock(p) },
                  { label: 'Variants', icon: Layers, onClick: () => openVariants(p) },
                  { label: 'Edit', icon: Pencil, onClick: () => openEdit(p) },
                  { label: 'Delete', icon: Trash2, onClick: () => openDelete(p), variant: 'danger' },
                ]} />
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} count={count} onChange={setPage} />

      <Modal isOpen={modal === 'create'} onClose={closeModal} title="New product" size="lg" footer={formFooter(handleCreate, 'Create product')}>
        <ErrorAlert message={error} />
        <ProductForm data={formData} onChange={setFormData} categories={categories} sellers={sellers} errors={fieldErrors} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit product" size="lg" footer={formFooter(handleEdit, 'Save changes')}>
        <ErrorAlert message={error} />
        <ProductForm data={formData} onChange={setFormData} categories={categories} sellers={sellers} errors={fieldErrors} />
      </Modal>

      <Modal isOpen={modal === 'addstock'} onClose={closeModal} title={`Add stock · ${selected?.name ?? ''}`} size="2xl"
        description="One line per color and size. Every unit gets its own barcode — you can print them next."
        footer={<>
          <Button onClick={closeModal}>Cancel</Button>
          <Button variant="primary" icon={PackagePlus} onClick={handleAddStock} loading={saving} disabled={!linesValid}>
            {totalUnits > 0 ? `Add ${totalUnits} unit${totalUnits !== 1 ? 's' : ''} & print` : 'Add & print'}
          </Button>
        </>}>
        <ErrorAlert message={error} />
        <AddStockLines lines={lines} onChange={setLines} variants={selected?.variants ?? []} colors={colors} sizes={sizes} errors={lineErrors} />
      </Modal>

      <Modal isOpen={modal === 'variants'} onClose={closeModal} title={`Variants · ${selected?.name ?? ''}`} size="xl"
        description="Change the low-stock alert level per variant. A variant can be deleted once it has no units.">
        <ErrorAlert message={error} onDismiss={() => setError('')} />
        <VariantList variants={selected?.variants ?? []} onThreshold={handleThreshold} onDelete={handleDeleteVariant} />
      </Modal>

      <ConfirmDialog isOpen={modal === 'delete'} onClose={closeModal} onConfirm={handleDelete} loading={saving}
        title="Delete product" message={`Delete "${selected?.name}"? This removes the product and all its stock units.`} />

      <PrintBarcodes items={printItems} title={`New stock — ${printItems?.[0]?.product_name ?? ''}`} onClose={() => setPrintItems(null)} />
    </div>
  )
}
