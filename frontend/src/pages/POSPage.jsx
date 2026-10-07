import { useEffect, useMemo, useRef, useState } from 'react'
import { lookupStockItem } from '../api/inventory'
import { variantLabel } from '../utils/variant'
import { lookupCustomers } from '../api/customers'
import { checkout, getStoreCredit } from '../api/billing'
import { getShopSettings, getPaymentMethods } from '../api/shopsettings'
import BillReceipt from '../components/billing/BillReceipt'
import ErrorAlert from '../components/common/ErrorAlert'

const money = (v) => `₹${Number(v).toFixed(2)}`

export default function POSPage() {
  const [cart, setCart] = useState([])
  const [scan, setScan] = useState('')
  const [customer, setCustomer] = useState({ name: '', phone: '' })
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
  const scanRef = useRef(null)

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

  const handleScan = async (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = scan.trim()
    setScan('')
    if (!code) return
    if (cart.some(l => l.code === code)) { setError(`Already added: ${code}`); return }
    setError('')
    try {
      const { data } = await lookupStockItem(code)
      setCart(c => [...c, { code: data.code, product_name: data.product_name, variant: variantLabel(data), unit_price: data.price }])
    } catch (err) {
      setError(err.response?.data?.detail || `Unknown code: ${code}`)
    }
    focusScan()
  }

  const removeLine = (code) => setCart(c => c.filter(l => l.code !== code))

  const handlePhoneBlur = async () => {
    setCreditBalance(0); setCreditUse('')
    if (customer.phone.length !== 10) return
    getStoreCredit(customer.phone).then(r => setCreditBalance(Number(r.data.balance))).catch(() => {})
    if (customer.name) return
    try {
      const { data } = await lookupCustomers(customer.phone)
      const match = data.find(c => c.phone === customer.phone) || data[0]
      if (match) setCustomer(c => ({ ...c, name: match.name }))
    } catch { /* ignore */ }
  }

  const customerReady = customer.phone.length === 10 && customer.name.trim().length > 0

  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (!customerReady) { setError('Customer name and a 10-digit phone are required.'); return }
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
      setCart([]); setCustomer({ name: '', phone: '' })
      setDiscountType('none'); setDiscountValue('')
      setCreditBalance(0); setCreditUse('')
    } catch (e) {
      const d = e.response?.data
      setError(d?.codes || d?.customer?.phone?.[0] || d?.customer?.name?.[0] || d?.customer?.[0] || d?.credit_used || d?.detail || 'Checkout failed.')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Billing (POS)</h1>
      <ErrorAlert message={error} onDismiss={() => setError('')} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart */}
        <div className="lg:col-span-2 space-y-4">
          <input
            ref={scanRef} autoFocus value={scan}
            onChange={e => setScan(e.target.value)} onKeyDown={handleScan}
            placeholder="Scan or type a barcode, then Enter…"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Item', 'Code', 'Price', ''].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cart.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Scan items to start a bill</td></tr>}
                {cart.map(l => (
                  <tr key={l.code}>
                    <td className="px-4 py-2 text-gray-800">
                      {l.product_name}
                      {l.variant && <div className="text-xs text-gray-400">{l.variant}</div>}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{l.code}</td>
                    <td className="px-4 py-2 text-gray-700">{money(l.unit_price)}</td>
                    <td className="px-4 py-2 text-right"><button onClick={() => removeLine(l.code)} className="text-xs text-red-500 hover:text-red-700">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Checkout panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 h-fit">
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">Customer <span className="text-red-500">*</span></div>
            <input value={customer.phone} onBlur={handlePhoneBlur}
              onChange={e => { setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }); setCreditBalance(0); setCreditUse('') }}
              type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} autoComplete="off"
              required placeholder="Phone *" className="w-full mb-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })}
              required placeholder="Name *" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          {creditBalance > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Store credit <span className="font-normal text-gray-500">({money(creditBalance)} available)</span></div>
              <div className="flex gap-2">
                <input type="number" min="0" max={creditBalance} value={creditUse} onChange={e => setCreditUse(e.target.value)}
                  placeholder="0" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <button type="button" onClick={() => setCreditUse(String(Math.min(creditBalance, totals.total)))}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-700 hover:bg-gray-50">Use max</button>
              </div>
            </div>
          )}

          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">Discount</div>
            <div className="flex gap-2">
              <select value={discountType} onChange={e => setDiscountType(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white">
                <option value="none">None</option>
                <option value="flat">₹ Flat</option>
                <option value="percent">%</option>
              </select>
              <input type="number" min="0" value={discountValue} onChange={e => setDiscountValue(e.target.value)} disabled={discountType === 'none'}
                placeholder="0" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-700 mb-1">Payment</div>
            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
              {paymentMethods.length === 0 && <option value="">No methods configured</option>}
              {paymentMethods.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
            <p className="mt-2 text-xs text-gray-400">Tax {taxRate}% (set in Settings) is applied automatically.</p>
          </div>

          <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
            <Row label="Subtotal" value={money(totals.subtotal)} />
            {totals.discount > 0 && <Row label="Discount" value={`− ${money(totals.discount)}`} />}
            {totals.tax > 0 && <Row label="Tax" value={money(totals.tax)} />}
            <div className="flex justify-between font-bold text-base pt-1"><span>Total</span><span>{money(totals.total)}</span></div>
            {totals.credit > 0 && (
              <>
                <Row label="Store credit" value={`− ${money(totals.credit)}`} />
                <div className="flex justify-between font-bold text-base"><span>To pay</span><span>{money(totals.toPay)}</span></div>
              </>
            )}
          </div>

          <button onClick={handleCheckout} disabled={saving || cart.length === 0 || !paymentMode || !customerReady}
            className="w-full bg-indigo-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Processing…' : `Checkout · ${money(totals.toPay)}`}
          </button>
          {cart.length > 0 && !customerReady && (
            <p className="text-xs text-gray-400 text-center">Enter the customer's 10-digit phone and name to check out.</p>
          )}
        </div>
      </div>

      <BillReceipt bill={receipt} onClose={() => { setReceipt(null); focusScan() }} />
    </div>
  )
}

function Row({ label, value }) {
  return <div className="flex justify-between text-gray-600"><span>{label}</span><span>{value}</span></div>
}
