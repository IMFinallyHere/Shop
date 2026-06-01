import { useEffect, useState } from 'react'
import {
  getProducts, createProduct, updateProduct, deleteProduct, addStock,
  getCategories, getSellers,
} from '../api/inventory'
import ActionMenu from '../components/common/ActionMenu'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import ProductForm from '../components/forms/ProductForm'
import PrintBarcodes from '../components/inventory/PrintBarcodes'
import SearchInput from '../components/common/SearchInput'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'

const EMPTY = { name: '', sku: '', category: '', seller: '', fabric_type: '', color: '', size: '', cost_price: '', price: '', low_stock_threshold: 5 }
const KNOWN = ['name', 'sku', 'category', 'seller', 'fabric_type', 'color', 'size', 'cost_price', 'price', 'low_stock_threshold']

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [formData, setFormData] = useState(EMPTY)
  const [categories, setCategories] = useState([])
  const [sellers, setSellers] = useState([])
  const [addQty, setAddQty] = useState('')
  const [printItems, setPrintItems] = useState(null)

  const PAGE_SIZE = 20

  useEffect(() => {
    getCategories().then(r => setCategories(r.data.results ?? r.data))
    getSellers().then(r => setSellers(r.data.results ?? r.data))
  }, [])

  useEffect(() => { fetchProducts() }, [page, search, lowOnly])

  const fetchProducts = () => {
    setLoading(true)
    const params = { page, search }
    if (lowOnly) params.low_stock = 1
    getProducts(params)
      .then(r => { setProducts(r.data.results ?? r.data); setCount(r.data.count ?? 0) })
      .catch(() => setError('Failed to load products.'))
      .finally(() => setLoading(false))
  }

  const clean = (d) => {
    const out = { ...d }
    if (out.category === '') out.category = null
    if (out.seller === '') out.seller = null
    return out
  }

  const openCreate = () => { setFormData({ ...EMPTY }); setFieldErrors({}); setModal('create') }
  const openEdit = (p) => {
    setSelected(p)
    setFormData({ name: p.name, sku: p.sku, category: p.category ?? '', seller: p.seller ?? '', fabric_type: p.fabric_type, color: p.color, size: p.size, cost_price: p.cost_price, price: p.price, low_stock_threshold: p.low_stock_threshold })
    setFieldErrors({}); setModal('edit')
  }
  const openDelete = (p) => { setSelected(p); setModal('delete') }
  const openAddStock = (p) => { setSelected(p); setAddQty(''); setError(''); setModal('addstock') }
  const closeModal = () => { setModal(null); setSelected(null); setError(''); setFieldErrors({}) }

  const parseErrors = (resp) => {
    const fields = {}; let general = ''
    Object.entries(resp || {}).forEach(([k, v]) => {
      const msg = Array.isArray(v) ? v[0] : v
      if (KNOWN.includes(k)) fields[k] = msg; else general += (general ? ' ' : '') + msg
    })
    return { fields, general }
  }

  const save = async (fn) => {
    setSaving(true); setError(''); setFieldErrors({})
    try { await fn(); fetchProducts(); closeModal() }
    catch (e) {
      const { fields, general } = parseErrors(e.response?.data)
      setFieldErrors(fields)
      setError(general || (Object.keys(fields).length ? '' : 'Something went wrong.'))
    } finally { setSaving(false) }
  }

  const handleCreate = () => save(() => createProduct(clean(formData)))
  const handleEdit = () => save(() => updateProduct(selected.id, clean(formData)))

  const handleDelete = async () => {
    setSaving(true)
    try { await deleteProduct(selected.id); fetchProducts(); closeModal() }
    catch (e) { setError(e.response?.data?.detail || 'Failed to delete.') }
    finally { setSaving(false) }
  }

  const handleAddStock = async () => {
    setSaving(true); setError('')
    try {
      const { data } = await addStock(selected.id, parseInt(addQty, 10))
      fetchProducts(); closeModal()
      setPrintItems(data.items)  // open the print view for the new batch
    } catch (e) {
      const q = e.response?.data?.quantity
      setError((Array.isArray(q) ? q[0] : q) || e.response?.data?.detail || 'Failed to add stock.')
    } finally { setSaving(false) }
  }

  const totalPages = Math.ceil(count / PAGE_SIZE)
  const money = (v) => `₹${Number(v).toLocaleString('en-IN')}`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Products</h1>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ New Product</button>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex-1"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search products…" /></div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={lowOnly} onChange={e => { setLowOnly(e.target.checked); setPage(1) }} className="w-4 h-4 text-indigo-600" />
          Low stock only
        </label>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError('')} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Product', 'Category', 'Seller', 'Price', 'Stock', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No products found</td></tr>}
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{p.name}</div>
                    <div className="text-xs text-gray-400">{[p.color, p.size, p.fabric_type].filter(Boolean).join(' · ') || p.sku || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.category_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.seller_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{money(p.price)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_low_stock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {p.stock_quantity}{p.is_low_stock ? ' · low' : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActionMenu actions={[
                      { label: 'Add Stock', icon: '📦', onClick: () => openAddStock(p) },
                      { label: 'Edit', icon: '✏️', onClick: () => openEdit(p) },
                      { label: 'Delete', icon: '🗑️', onClick: () => openDelete(p), variant: 'danger' },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded border text-sm disabled:opacity-40">Prev</button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded border text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal isOpen={modal === 'create'} onClose={closeModal} title="New Product" size="lg">
        <ErrorAlert message={error} />
        <ProductForm data={formData} onChange={setFormData} categories={categories} sellers={sellers} errors={fieldErrors} />
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Product" size="lg">
        <ErrorAlert message={error} />
        <ProductForm data={formData} onChange={setFormData} categories={categories} sellers={sellers} errors={fieldErrors} />
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={handleEdit} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'addstock'} onClose={closeModal} title={`Add Stock — ${selected?.name}`} size="sm">
        <ErrorAlert message={error} />
        <p className="text-sm text-gray-500 mb-3">
          Current units in stock: <span className="font-medium text-gray-800">{selected?.stock_quantity}</span>.
          Each unit added gets its own barcode; you can print them next.
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to add</label>
        <input type="number" min="1" autoFocus value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="e.g. 5"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={handleAddStock} disabled={saving || !addQty || Number(addQty) < 1} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{saving ? 'Adding…' : 'Add & print'}</button>
        </div>
      </Modal>

      <ConfirmDialog isOpen={modal === 'delete'} onClose={closeModal} onConfirm={handleDelete} loading={saving}
        title="Delete Product" message={`Delete "${selected?.name}"? This removes the product and all its stock units.`} />

      <PrintBarcodes items={printItems} title={`New stock — ${printItems?.[0]?.product_name ?? ''}`} onClose={() => setPrintItems(null)} />
    </div>
  )
}
