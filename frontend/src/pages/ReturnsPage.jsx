import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createReturn, findBillByCode, getBill, getReturn, getReturns } from '../api/billing'
import { getPaymentMethods } from '../api/shopsettings'
import ReturnReceipt from '../components/billing/ReturnReceipt'
import SearchInput from '../components/common/SearchInput'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'

const money = (v) => `₹${Number(v).toFixed(2)}`
const PAGE_SIZE = 20

// "INV-00012" or "12" → 12
const parseBillNumber = (v) => {
  const n = parseInt(String(v).replace(/^INV-?/i, ''), 10)
  return Number.isNaN(n) ? null : n
}

export default function ReturnsPage() {
  const [params, setParams] = useSearchParams()
  const [scan, setScan] = useState('')
  const [bill, setBill] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [mode, setMode] = useState('refund')
  const [paymentMethods, setPaymentMethods] = useState([])
  const [paymentMode, setPaymentMode] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const scanRef = useRef(null)

  const [returns, setReturns] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getPaymentMethods({ active: 1 }).then(r => {
      const list = r.data.results ?? r.data
      setPaymentMethods(list)
      if (list.length) setPaymentMode(list[0].name)
    }).catch(() => {})
  }, [])

  const fetchReturns = () => {
    setLoading(true)
    getReturns({ page, search })
      .then(r => { setReturns(r.data.results ?? r.data); setCount(r.data.count ?? 0) })
      .catch(() => setError('Failed to load returns.'))
      .finally(() => setLoading(false))
  }

  const loadBill = async (fetcher) => {
    setError('')
    try {
      const { data } = await fetcher()
      setBill(data)
      setSelected(new Set(data.scanned_item ? [data.scanned_item] : []))
      setMode('refund'); setReason('')
    } catch (e) {
      setError(e.response?.data?.detail || 'Bill not found.')
    }
  }

  // Preload a bill when arriving from Sales (?bill=<id>).
  useEffect(() => {
    const id = params.get('bill')
    if (id) loadBill(() => getBill(id)) // eslint-disable-line react-hooks/set-state-in-effect
  }, [params])

  useEffect(() => { fetchReturns() }, [page, search]) // eslint-disable-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps

  const handleScan = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const value = scan.trim()
    setScan('')
    if (!value) return
    // A bill number (INV-00012) loads the bill; anything else is a unit barcode.
    if (/^INV-?\d+$/i.test(value)) loadBill(() => getBill(parseBillNumber(value)))
    else if (bill && bill.items.some(i => i.code === value && !i.returned)) {
      const item = bill.items.find(i => i.code === value)
      setSelected(s => new Set(s).add(item.id))
    } else loadBill(() => findBillByCode(value))
  }

  const toggle = (id) => setSelected(s => {
    const next = new Set(s)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const refund = useMemo(
    () => (bill?.items ?? []).filter(i => selected.has(i.id)).reduce((s, i) => s + Number(i.refund_amount), 0),
    [bill, selected],
  )

  const clear = () => {
    setBill(null); setSelected(new Set())
    if (params.get('bill')) setParams({})
    setTimeout(() => scanRef.current?.focus(), 0)
  }

  const handleSubmit = async () => {
    if (!bill || selected.size === 0) return
    setSaving(true); setError('')
    try {
      const { data } = await createReturn({
        bill: bill.id, items: [...selected], mode,
        payment_mode: mode === 'refund' ? paymentMode : '', reason,
      })
      setReceipt(data)
      clear()
      fetchReturns()
    } catch (e) {
      const d = e.response?.data
      setError(d?.items || d?.mode || d?.payment_mode || d?.bill || d?.detail || 'Return failed.')
    } finally { setSaving(false) }
  }

  const openReceipt = (id) => getReturn(id).then(r => setReceipt(r.data)).catch(() => setError('Failed to load return.'))
  const totalPages = Math.ceil(count / PAGE_SIZE)
  const allReturned = bill?.items.every(i => i.returned)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Returns</h1>
      <ErrorAlert message={error} onDismiss={() => setError('')} />

      <input
        ref={scanRef} autoFocus value={scan}
        onChange={e => setScan(e.target.value)} onKeyDown={handleScan}
        placeholder="Scan a returned item's barcode, or type a bill no. (INV-00012), then Enter…"
        className="w-full mb-6 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      {bill && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-gray-800">{bill.number}</span>
                <span className="ml-3 text-xs text-gray-500">{new Date(bill.created_at).toLocaleString()}</span>
                {bill.customer_name && <span className="ml-3 text-xs text-gray-500">{bill.customer_name} · {bill.customer_phone}</span>}
              </div>
              <button onClick={clear} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['', 'Item', 'Code', 'Price', 'Refund'].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bill.items.map(i => (
                  <tr key={i.id} className={i.returned ? 'text-gray-400' : 'cursor-pointer hover:bg-gray-50'} onClick={() => !i.returned && toggle(i.id)}>
                    <td className="px-4 py-2">
                      <input type="checkbox" disabled={i.returned} checked={selected.has(i.id)} onChange={() => toggle(i.id)} onClick={e => e.stopPropagation()} />
                    </td>
                    <td className="px-4 py-2">
                      {i.product_name}
                      {i.returned && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px]">Returned</span>}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{i.code}</td>
                    <td className="px-4 py-2">{money(i.unit_price)}</td>
                    <td className="px-4 py-2">{money(i.refund_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-gray-400">Refund is each item's share of the bill total (discount and tax included). Returned units go back into stock.</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 h-fit">
            {allReturned ? <p className="text-sm text-gray-500">Every item on this bill has been returned.</p> : (
              <>
                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-2">Settle as</div>
                  <label className="flex items-center gap-2 text-sm mb-1">
                    <input type="radio" checked={mode === 'refund'} onChange={() => setMode('refund')} /> Refund
                  </label>
                  <label className={`flex items-center gap-2 text-sm ${bill.customer_id ? '' : 'text-gray-400'}`}>
                    <input type="radio" disabled={!bill.customer_id} checked={mode === 'credit'} onChange={() => setMode('credit')} /> Store credit
                  </label>
                  {!bill.customer_id && <p className="mt-1 text-xs text-gray-400">Store credit needs a customer on the bill.</p>}
                </div>

                {mode === 'refund' && (
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-1">Refund via</div>
                    <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                      {paymentMethods.length === 0 && <option value="">No methods configured</option>}
                      {paymentMethods.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                  </div>
                )}

                <input value={reason} onChange={e => setReason(e.target.value)} maxLength={255}
                  placeholder="Reason (optional)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />

                <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-base">
                  <span>{mode === 'credit' ? 'Credit' : 'Refund'}</span><span>{money(refund)}</span>
                </div>

                <button onClick={handleSubmit} disabled={saving || selected.size === 0 || (mode === 'refund' && !paymentMode)}
                  className="w-full bg-indigo-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Processing…' : `Return ${selected.size} item${selected.size === 1 ? '' : 's'} · ${money(refund)}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-800 mb-3">Past returns</h2>
      <div className="mb-4"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search by customer…" /></div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Return', 'Bill', 'Date', 'Customer', 'Items', 'Settled', 'Amount', ''].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No returns yet</td></tr>}
              {returns.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.number}</td>
                  <td className="px-4 py-3 text-gray-600">{r.bill_number}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-600">{r.customer_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.items.length}</td>
                  <td className="px-4 py-3 text-gray-600">{r.mode === 'credit' ? 'Store credit' : r.payment_mode}</td>
                  <td className="px-4 py-3 text-gray-800">{money(r.amount)}</td>
                  <td className="px-4 py-3"><button onClick={() => openReceipt(r.id)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">View / Print</button></td>
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

      <ReturnReceipt ret={receipt} onClose={() => { setReceipt(null); scanRef.current?.focus() }} />
    </div>
  )
}
