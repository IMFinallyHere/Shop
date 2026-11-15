import { useEffect, useState } from 'react'
import {
  addStock, getCategories, getProductBatches, getSellers, updateProduct, updateProductBatches,
} from '../../api/inventory'
import { getColors, getSizes } from '../../api/shopsettings'
import usePrintSettings from '../../hooks/usePrintSettings'
import Modal from '../common/Modal'
import ErrorAlert from '../common/ErrorAlert'
import ProductForm from '../forms/ProductForm'
import AddStockLines from './AddStockLines'
import CurrentStockRows from './CurrentStockRows'
import QuickAddDialog from './QuickAddDialog'
import Button from '../ui/Button'
import { useToast } from '../ui/Toast'
import { EMPTY_LINE, toStockPayload } from '../../utils/variant'

const KNOWN = ['name', 'sku', 'category', 'seller', 'fabric_type']
const STOCK_KEYS = ['color', 'size', 'quantity', 'cost_price', 'price']
// A stock line counts once anything but the helper margin is filled in.
const isUsed = (l) => Object.entries(l).some(([k, v]) => k !== 'margin' && v !== '')

// The Edit product dialog (product details, current stock, add stock), shared by the Products and
// Missing details pages. `product` is the product being edited (null = closed). `onSaved(newUnits)`
// runs after a save; `newUnits` are units that were just created (for printing their labels).
export default function EditProductModal({ product, onClose, onSaved }) {
  // Remount per product so every form starts from that product's values.
  return product ? <EditProductForm key={product.id} product={product} onClose={onClose} onSaved={onSaved} /> : null
}

function EditProductForm({ product, onClose, onSaved }) {
  const toast = useToast()
  const shopSettings = usePrintSettings()
  const hideName = !!shopSettings.hide_product_name
  const [formData, setFormData] = useState({
    name: product.name, sku: product.sku, category: product.category ?? '', seller: product.seller ?? '',
    fabric_type: product.fabric_type, is_one_time: product.is_one_time, is_active: product.is_active,
  })
  const [categories, setCategories] = useState([])
  const [sellers, setSellers] = useState([])
  const [colors, setColors] = useState([])
  const [sizes, setSizes] = useState([])
  const [current, setCurrent] = useState([])
  const [currentOrig, setCurrentOrig] = useState([])
  const [currentErrors, setCurrentErrors] = useState({})
  const [lines, setLines] = useState([{ ...EMPTY_LINE }])
  const [lineErrors, setLineErrors] = useState([])
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // "Add new" in the Category / Seller dropdowns opens the full form; resolves with the new id.
  const [quick, setQuick] = useState(null)
  const askCreate = (kind) => (name) => new Promise(resolve => setQuick({ kind, name, resolve }))

  const loadCurrent = () => getProductBatches(product.id)
    .then(r => { setCurrent(r.data); setCurrentOrig(r.data) }).catch(() => setError('Failed to load current stock.'))

  useEffect(() => {
    getCategories({ all: 1 }).then(r => setCategories(r.data.results ?? r.data)).catch(() => {})
    getSellers({ all: 1 }).then(r => setSellers(r.data.results ?? r.data)).catch(() => {})
    getColors({ active: 1 }).then(r => setColors(r.data)).catch(() => setError('Failed to load colors.'))
    getSizes({ active: 1 }).then(r => setSizes(r.data)).catch(() => setError('Failed to load sizes.'))
    loadCurrent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const quickDone = (record) => {
    (quick.kind === 'seller' ? setSellers : setCategories)(l => [...l, record].sort((a, b) => a.name.localeCompare(b.name)))
    quick.resolve(record.id); setQuick(null)
  }

  const clean = (d) => ({ ...d, category: d.category === '' ? null : d.category, seller: d.seller === '' ? null : d.seller })
  const parseErrors = (resp) => {
    const fields = {}; let general = ''
    Object.entries(resp || {}).forEach(([k, v]) => {
      const msg = Array.isArray(v) ? v[0] : v
      if (KNOWN.includes(k)) fields[k] = msg; else general += (general ? ' ' : '') + msg
    })
    return { fields, general }
  }
  const showStockError = (e) => {
    const errs = e.response?.data?.lines
    if (Array.isArray(errs) && typeof errs[0] === 'object') {
      setLineErrors(errs.map(le => Object.fromEntries(Object.entries(le || {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))))
    } else {
      setError((Array.isArray(errs) ? errs[0] : errs) || e.response?.data?.detail || 'Failed to add stock.')
    }
  }

  const usedLines = lines.filter(isUsed)
  const lineOk = (l) => Number(l.quantity) >= 1 && l.price !== '' && (!shopSettings.require_cost_price || l.cost_price !== '')
  const stockValid = usedLines.every(lineOk)
  const newUnits = usedLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0)
  const missingRequired = (shopSettings.require_category && !formData.category) || (shopSettings.require_seller && !formData.seller)
    || (shopSettings.require_sku && !String(formData.sku ?? '').trim()) || (!hideName && !formData.name.trim())
  const rowsInvalid = current.some(r => !r.removed && (r.quantity === '' || r.price === ''))

  const save = async () => {
    setSaving(true); setError(''); setFieldErrors({}); setLineErrors([]); setCurrentErrors({})
    try {
      await updateProduct(product.id, clean(formData))
    } catch (e) {
      const { fields, general } = parseErrors(e.response?.data)
      setFieldErrors(fields)
      setError(general || (Object.keys(fields).length ? '' : 'Something went wrong.'))
      setSaving(false)
      return
    }
    // Edited current stock rows (colour/size, qty, cost, price, removal) go first.
    const edited = current.filter((r, i) => r.removed || STOCK_KEYS.some(k => String(r[k] ?? '') !== String(currentOrig[i]?.[k] ?? '')))
    let units = []
    if (edited.length) {
      try {
        const { data } = await updateProductBatches(product.id, edited.map(r => ({
          id: r.id, color: r.color || null, size: r.size || null, quantity: r.removed ? 0 : Number(r.quantity) || 0,
          cost_price: r.cost_price === '' || r.cost_price == null ? null : r.cost_price, price: r.price,
        })))
        units = data.added
      } catch (e) {
        const errs = e.response?.data?.batches
        if (Array.isArray(errs)) {
          const byId = {}
          errs.forEach((le, j) => { if (le && Object.keys(le).length) byId[edited[j].id] = le })
          setCurrentErrors(Object.fromEntries(current.map((r, i) => [i, Object.fromEntries(Object.entries(byId[r.id] || {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))])))
        }
        setError(e.response?.data?.detail || 'Could not update the current stock. Product details were saved.')
        onSaved([]); setSaving(false)
        return
      }
    }
    try {
      if (usedLines.length) units = [...units, ...(await addStock(product.id, toStockPayload(usedLines))).data.items]
      toast(units.length ? `Product updated · ${units.length} unit${units.length !== 1 ? 's' : ''} added` : 'Product updated')
      onSaved(units); onClose()
    } catch (e) {
      // The product and its current stock are saved; keep the typed lines so nothing is lost.
      toast('Product updated, but its new stock was not added', 'error')
      showStockError(e)
      onSaved(units); loadCurrent()
    } finally { setSaving(false) }
  }

  return (
    <>
      <Modal isOpen onClose={onClose} title="Edit product" size="3xl"
        description="Change the product and its current stock, or add more stock below."
        footer={<>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={missingRequired || !stockValid || rowsInvalid}>
            {newUnits > 0 ? `Save & add ${newUnits} unit${newUnits !== 1 ? 's' : ''}` : current.some(r => r.removed) ? 'Save & remove stock' : 'Save changes'}
          </Button>
        </>}>
        <ErrorAlert message={error} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <section aria-label="Product details">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">Product</h3>
            <ProductForm data={formData} onChange={setFormData} categories={categories} sellers={sellers} errors={fieldErrors}
              hideName={hideName} requireCategory={shopSettings.require_category} requireSeller={shopSettings.require_seller} requireSku={shopSettings.require_sku} showActive compact
              onCreateCategory={askCreate('category')} onCreateSeller={askCreate('seller')} />
          </section>
          <section aria-label="Stock" className="min-w-0 lg:border-l lg:border-zinc-100 lg:pl-6">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">Current stock</h3>
            <CurrentStockRows rows={current} original={currentOrig} onChange={setCurrent} colors={colors} sizes={sizes} errors={currentErrors}
              requireCost={shopSettings.require_cost_price} />
            <p className="mt-1.5 text-xs text-zinc-500">Change a colour, size, quantity or price here. Lowering Qty removes the newest units. The dustbin removes a whole row (added by mistake) when you save. Sold units are never touched.</p>
            <h3 className="mb-3 mt-6 text-sm font-semibold text-zinc-900">Add stock <span className="font-normal text-zinc-500">(optional)</span></h3>
            <AddStockLines lines={lines} onChange={setLines} variants={product.variants ?? []} colors={colors} sizes={sizes} errors={lineErrors}
              requireCost={shopSettings.require_cost_price} />
          </section>
        </div>
      </Modal>
      {quick && <QuickAddDialog kind={quick.kind} initialName={quick.name} onCreated={quickDone} onClose={() => { quick.resolve(null); setQuick(null) }} />}
    </>
  )
}
