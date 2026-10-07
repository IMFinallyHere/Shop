import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ScanBarcode, Trash2, X, UserRound, Wallet, ShoppingCart, BadgeCheck } from 'lucide-react'
import { lookupStockItem } from '../api/inventory'
import { variantLabel } from '../utils/variant'
import { lookupCustomers } from '../api/customers'
import { checkout, getStoreCredit } from '../api/billing'
import { getShopSettings, getPaymentMethods } from '../api/shopsettings'
import BillReceipt from '../components/billing/BillReceipt'
import ErrorAlert from '../components/common/ErrorAlert'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input } from '../components/ui/Field'
import SegmentedControl from '../components/ui/SegmentedControl'
import { useToast } from '../components/ui/Toast'
import { money } from '../utils/format'

const DISCOUNTS = [
  { value: 'none', label: 'None' },
  { value: 'flat', label: '₹ Flat' },
  { value: 'percent', label: '% Off' },
]

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)

function Kbd({ children }) {
  return <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-zinc-500">{children}</kbd>
}

export default function POSPage() {
  const [cart, setCart] = useState([])
  const [scan, setScan] = useState('')
  const [scanError, setScanError] = useState('')
  const [lastAdded, setLastAdded] = useState(null)
  const [customer, setCustomer] = useState({ name: '', phone: '' })
  const [returning, setReturning] = useState(false)   // name was auto-filled from an existing customer
  const [discountType, setDiscountType] = useState('none')
  const [discountValue, setDiscountValue] = useState('')
  const [taxRate, setTaxRate] = useState(0)            // from shop settings (read-only here)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [paymentMode, setPaymentMode] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [creditBalance, setCreditBalance] = useState(0)   // this shop's store credit for the phone
  const [creditUse, setCreditUse] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const scanRef = useRef(null)
  const checkoutRef = useRef(null)
  const toast = useToast()

  useEffect(() => {
    getShopSettings().then(r => setTaxRate(Number(r.data.default_tax_rate))).catch(() => {})
    getPaymentMethods({ active: 1 }).then(r => {
      const list = r.data.results ?? r.data
      setPaymentMethods(list)
      if (list.length) setPaymentMode(list[0].name)
    }).catch(() => {})
  }, [])

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, l) => s + Number(l.unit_price), 0)
    let discount = 0
    if (discountType === 'flat') discount = Math.min(Number(discountValue || 0), subtotal)
    else if (discountType === 'percent') discount = subtotal * Number(discountValue || 0) / 100
    const taxable = subtotal - discount
    const tax = taxable * Number(taxRate || 0) / 100
    const total = Math.round((taxable + tax) * 100) / 100
    const credit = Math.min(Number(creditUse || 0), creditBalance, total)
    return { subtotal, discount, tax, total, credit, toPay: total - credit }
  }, [cart, discountType, discountValue, taxRate, creditUse, creditBalance])

  const focusScan = () => setTimeout(() => scanRef.current?.focus(), 0)

  // F2 → scan box, Ctrl/⌘+Enter → checkout (via ref so the listener sees fresh state).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F2') { e.preventDefault(); scanRef.current?.focus() }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); checkoutRef.current?.() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const handleScan = async (e) => {
    if (e.key === 'Escape') { setScan(''); setScanError(''); return }
    if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return
    e.preventDefault()
    const code = scan.trim()
    setScan('')
    if (!code) return
    if (cart.some(l => l.code === code)) { setScanError(`Already in this bill: ${code}`); return }
    setScanError('')
    try {
      const { data } = await lookupStockItem(code)
      setCart(c => [{ code: data.code, product_name: data.product_name, variant: variantLabel(data), unit_price: data.price }, ...c])
      setLastAdded(data.code)
    } catch (err) {
      setScanError(err.response?.data?.detail || `No item in stock with code ${code}`)
    }
    focusScan()
  }

  const removeLine = (code) => { setCart(c => c.filter(l => l.code !== code)); focusScan() }

  const handlePhoneBlur = async () => {
    setCreditBalance(0); setCreditUse('')
    if (customer.phone.length !== 10) return
    getStoreCredit(customer.phone).then(r => setCreditBalance(Number(r.data.balance))).catch(() => {})
    if (customer.name) return
    try {
      const { data } = await lookupCustomers(customer.phone)
      const match = data.find(c => c.phone === customer.phone) || data[0]
      if (match) { setCustomer(c => ({ ...c, name: match.name })); setReturning(true) }
    } catch { /* ignore */ }
  }

  const customerReady = customer.phone.length === 10 && customer.name.trim().length > 0
  const canCheckout = !saving && cart.length > 0 && !!paymentMode && customerReady

  const resetBill = () => {
    setCart([]); setCustomer({ name: '', phone: '' }); setReturning(false)
    setDiscountType('none'); setDiscountValue('')
    setCreditBalance(0); setCreditUse(''); setScanError(''); setError('')
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (!customerReady) { setError('Customer name and a 10-digit phone are required.'); return }
    if (!paymentMode) return
    setSaving(true); setError('')
    try {
      const { data } = await checkout({
        codes: cart.map(l => l.code),
        customer: { name: customer.name.trim(), phone: customer.phone },
        discount_type: discountType,
        discount_value: discountValue || 0,
        payment_mode: paymentMode,
        credit_used: totals.credit.toFixed(2),
      })
      setReceipt(data)
      resetBill()
      toast(`Bill ${data.number} saved`)
    } catch (e) {
      const d = e.response?.data
      setError(d?.codes || d?.customer?.phone?.[0] || d?.customer?.name?.[0] || d?.customer?.[0] || d?.credit_used || d?.detail || 'Checkout failed.')
    } finally { setSaving(false) }
  }
  useEffect(() => { checkoutRef.current = canCheckout ? handleCheckout : null })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      {/* Left: scan + cart */}
      <div className="min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">New bill</h1>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirmClear(true)}>Clear</Button>
          )}
        </div>

        <div>
          <div className={clsx('flex items-center gap-3 rounded-xl border bg-white px-4 shadow-card transition-colors focus-within:ring-4',
            scanError ? 'border-red-300 focus-within:ring-red-500/10' : 'border-zinc-300 focus-within:border-brand-500 focus-within:ring-brand-500/10')}>
            <ScanBarcode size={22} className="shrink-0 text-zinc-400" />
            <input
              ref={scanRef} autoFocus value={scan}
              onChange={e => setScan(e.target.value)} onKeyDown={handleScan}
              placeholder="Scan or type a barcode, then Enter"
              className="h-14 flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              aria-label="Barcode"
            />
            <span className="hidden sm:inline"><Kbd>F2</Kbd></span>
          </div>
          {scanError && <p className="mt-1.5 flex items-center gap-1.5 px-1 text-sm text-red-600"><X size={14} />{scanError}</p>}
        </div>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
            <span className="text-sm font-medium text-zinc-900">Items</span>
            <span className="text-sm text-zinc-500">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
          </div>
          {cart.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500"><ShoppingCart size={22} /></div>
              <p className="text-sm font-medium text-zinc-900">Scan items to start a bill</p>
              <p className="mt-1 text-sm text-zinc-500">Each unit has its own barcode — scan it and it's added here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {cart.map((l, i) => (
                <li key={l.code} className={clsx('group flex items-center gap-4 px-5 py-3', l.code === lastAdded && 'animate-flash')}>
                  <span className="w-5 text-right text-xs tabular-nums text-zinc-400">{cart.length - i}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-900">{l.product_name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      {l.variant && <span>{l.variant} ·</span>}
                      <span className="font-mono">{l.code}</span>
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-zinc-900">{money(l.unit_price)}</div>
                  <button onClick={() => removeLine(l.code)} className="rounded-md p-1.5 text-zinc-300 hover:bg-red-50 hover:text-red-600 group-hover:text-zinc-400" aria-label={`Remove ${l.product_name}`}>
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Right: checkout panel */}
      <div className="lg:sticky lg:top-0 lg:self-start">
        <Card className="divide-y divide-zinc-100">
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-900"><UserRound size={16} className="text-zinc-400" />Customer</div>
            <Input value={customer.phone} onBlur={handlePhoneBlur}
              onChange={e => { setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }); setCreditBalance(0); setCreditUse(''); setReturning(false) }}
              type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} autoComplete="off"
              required placeholder="10-digit phone" aria-label="Customer phone" />
            <div className="relative">
              <Input value={customer.name} onChange={e => { setCustomer({ ...customer, name: e.target.value }); setReturning(false) }}
                required placeholder="Name" aria-label="Customer name" className={returning ? 'pr-28' : ''} />
              {returning && (
                <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <BadgeCheck size={12} /> Returning
                </span>
              )}
            </div>
            {creditBalance > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm text-emerald-800">
                  <Wallet size={15} /> <span><span className="font-semibold">{money(creditBalance)}</span> store credit available</span>
                </div>
                <div className="flex gap-2">
                  <Input type="number" min="0" max={creditBalance} value={creditUse} onChange={e => setCreditUse(e.target.value)} placeholder="Amount to use" className="bg-white" />
                  <Button size="md" onClick={() => setCreditUse(String(Math.min(creditBalance, totals.total)))}>Use max</Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 p-5">
            <Field label="Discount">
              <div className="flex gap-2">
                <SegmentedControl options={DISCOUNTS} value={discountType} onChange={v => { setDiscountType(v); if (v === 'none') setDiscountValue('') }} />
                {discountType !== 'none' && (
                  <Input type="number" min="0" value={discountValue} onChange={e => setDiscountValue(e.target.value)} autoFocus
                    placeholder={discountType === 'percent' ? '%' : '₹'} className="flex-1" aria-label="Discount value" />
                )}
              </div>
            </Field>
            <Field label="Payment">
              {paymentMethods.length === 0
                ? <p className="text-sm text-zinc-500">No payment methods set up. <Link to="/settings" className="font-medium text-brand-600 hover:underline">Add one in Settings</Link></p>
                : <SegmentedControl stretch options={paymentMethods.map(m => ({ value: m.name, label: m.name }))} value={paymentMode} onChange={setPaymentMode} />}
            </Field>
          </div>

          <div className="space-y-1.5 p-5 text-sm">
            <Row label="Subtotal" value={money(totals.subtotal)} />
            {totals.discount > 0 && <Row label="Discount" value={`− ${money(totals.discount)}`} />}
            <Row label={`Tax (${taxRate}%)`} value={money(totals.tax)} />
            {totals.credit > 0 && <Row label="Store credit" value={`− ${money(totals.credit)}`} />}
            <div className="flex items-baseline justify-between pt-2">
              <span className="font-medium text-zinc-900">{totals.credit > 0 ? 'To pay' : 'Total'}</span>
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">{money(totals.toPay)}</span>
            </div>
          </div>

          <div className="p-5">
            <ErrorAlert message={error} onDismiss={() => setError('')} />
            <Button variant="primary" size="lg" className="w-full" onClick={handleCheckout} disabled={!canCheckout} loading={saving}>
              {saving ? 'Processing…' : `Charge ${money(totals.toPay)}`}
            </Button>
            <p className="mt-2.5 text-center text-xs text-zinc-500">
              {cart.length > 0 && !customerReady
                ? "Enter the customer's phone and name to check out."
                : <>Press <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd> <Kbd>Enter</Kbd> to charge</>}
            </p>
          </div>
        </Card>
      </div>

      <BillReceipt bill={receipt} onClose={() => { setReceipt(null); focusScan() }} />
      <ConfirmDialog isOpen={confirmClear} onClose={() => setConfirmClear(false)} title="Clear this bill?"
        message="All scanned items and customer details will be removed." confirmLabel="Clear bill"
        onConfirm={() => { resetBill(); setConfirmClear(false); focusScan() }} />
    </div>
  )
}

function Row({ label, value }) {
  return <div className="flex justify-between text-zinc-500"><span>{label}</span><span className="tabular-nums text-zinc-700">{value}</span></div>
}
