import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { Eye, ScanBarcode, Undo2, X } from 'lucide-react'
import { createReturn, findBillByCode, getBill, getReturn, getReturns } from '../api/billing'
import { getPaymentMethods } from '../api/shopsettings'
import useQuery, { asList } from '../hooks/useQuery'
import ReturnReceipt from '../components/billing/ReturnReceipt'
import SearchInput from '../components/common/SearchInput'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { Field, Input } from '../components/ui/Field'
import Pagination from '../components/ui/Pagination'
import SegmentedControl from '../components/ui/SegmentedControl'
import { Table, Td, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'
import { formatDate, formatDateTime, money } from '../utils/format'

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
  const toast = useToast()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const { data, loading, error: loadError, reload } = useQuery(() => getReturns({ page, search }), `${page}|${search}`)
  const { rows: returns, count } = asList(data)

  useEffect(() => {
    getPaymentMethods({ active: 1 }).then(r => {
      const list = r.data.results ?? r.data
      setPaymentMethods(list)
      if (list.length) setPaymentMode(list[0].name)
    }).catch(() => {})
  }, [])

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
      toast(`Return ${data.number} recorded`)
      clear()
      reload()
    } catch (e) {
      const d = e.response?.data
      setError(d?.items || d?.mode || d?.payment_mode || d?.bill || d?.detail || 'Return failed.')
    } finally { setSaving(false) }
  }

  const openReceipt = (id) => getReturn(id).then(r => setReceipt(r.data)).catch(() => setError('Failed to load return.'))
  const allReturned = bill?.items.every(i => i.returned)

  return (
    <div>
      <PageHeader title="Returns" subtitle="Scan a returned item or enter its bill number to start." />

      <div className="mb-6">
        <div className="flex items-center gap-3 rounded-xl border border-zinc-300 bg-white px-4 shadow-card transition-colors focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
          <ScanBarcode size={22} className="shrink-0 text-zinc-400" />
          <input
            ref={scanRef} autoFocus value={scan}
            onChange={e => setScan(e.target.value)} onKeyDown={handleScan}
            placeholder="Scan the item's barcode, or type a bill no. like INV-00012"
            className="h-14 flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            aria-label="Barcode or bill number"
          />
        </div>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError('')} />

      {bill && (
        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
              <div className="min-w-0">
                <div className="font-semibold text-zinc-900">{bill.number}</div>
                <div className="text-xs text-zinc-500">
                  {formatDateTime(bill.created_at)}
                  {bill.customer_name && ` · ${bill.customer_name} · ${bill.customer_phone}`}
                </div>
              </div>
              <Button variant="ghost" size="sm" icon={X} onClick={clear}>Clear</Button>
            </div>
            <div className="px-5 pt-3 text-xs font-medium text-zinc-500">Select the items being returned</div>
            <ul className="divide-y divide-zinc-100 p-2">
              {bill.items.map(i => (
                <li key={i.id}>
                  <label className={clsx('flex items-center gap-3 rounded-lg px-3 py-2.5',
                    i.returned ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-zinc-50',
                    selected.has(i.id) && 'bg-brand-50/60 hover:bg-brand-50')}>
                    <input type="checkbox" disabled={i.returned} checked={selected.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4 accent-brand-600" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-zinc-900">{i.product_name}</div>
                      <div className="font-mono text-xs text-zinc-500">{i.code}</div>
                    </div>
                    {i.returned
                      ? <Badge>Returned</Badge>
                      : <div className="text-right">
                          <div className="text-sm font-medium tabular-nums text-zinc-900">{money(i.refund_amount)}</div>
                          {Number(i.refund_amount) !== Number(i.unit_price) && <div className="text-xs tabular-nums text-zinc-400 line-through">{money(i.unit_price)}</div>}
                        </div>}
                  </label>
                </li>
              ))}
            </ul>
            <p className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">Refund is each item's share of the bill total (discount and tax included). Returned units go back into stock.</p>
          </Card>

          <div className="lg:sticky lg:top-0 lg:self-start">
            <Card className="space-y-4 p-5">
              {allReturned ? <p className="text-sm text-zinc-500">Every item on this bill has been returned.</p> : (
                <>
                  <Field label="Settle as" hint={!bill.customer_id ? 'Store credit needs a customer on the bill.' : undefined}>
                    <SegmentedControl stretch value={mode} onChange={v => (v === 'credit' && !bill.customer_id) ? null : setMode(v)}
                      options={[{ value: 'refund', label: 'Refund' }, { value: 'credit', label: 'Store credit' }]} />
                  </Field>

                  {mode === 'refund' && (
                    <Field label="Refund via">
                      {paymentMethods.length === 0
                        ? <p className="text-sm text-zinc-500">No payment methods configured.</p>
                        : <SegmentedControl stretch options={paymentMethods.map(m => ({ value: m.name, label: m.name }))} value={paymentMode} onChange={setPaymentMode} />}
                    </Field>
                  )}

                  <Field label="Reason">
                    {id => <Input id={id} value={reason} onChange={e => setReason(e.target.value)} maxLength={255} placeholder="Optional — e.g. size didn't fit" />}
                  </Field>

                  <div className="flex items-baseline justify-between border-t border-zinc-100 pt-4">
                    <span className="font-medium text-zinc-900">{mode === 'credit' ? 'Credit' : 'Refund'}</span>
                    <span className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">{money(refund)}</span>
                  </div>

                  <Button variant="primary" size="lg" className="w-full" icon={Undo2} onClick={handleSubmit} loading={saving}
                    disabled={selected.size === 0 || (mode === 'refund' && !paymentMode)}>
                    {selected.size === 0 ? 'Select items to return' : `Return ${selected.size} item${selected.size === 1 ? '' : 's'}`}
                  </Button>
                </>
              )}
            </Card>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900">Past returns</h2>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search by customer…" />
      </div>
      <ErrorAlert message={loadError && 'Failed to load returns.'} />
      <Table
        columns={[{ label: 'Return' }, { label: 'Bill' }, { label: 'Date' }, { label: 'Customer' }, { label: 'Items' }, { label: 'Settled' }, { label: 'Amount', className: 'text-right' }, { label: '', className: 'w-px' }]}
        loading={loading} isEmpty={returns.length === 0}
        empty={{ icon: Undo2, title: search ? 'No matching returns' : 'No returns yet', description: search ? 'Try a different customer name.' : 'Processed returns and credit notes will be listed here.' }}
      >
        {returns.map(r => (
          <Tr key={r.id} className="cursor-pointer" onClick={() => openReceipt(r.id)}>
            <Td className="font-medium text-zinc-900">{r.number}</Td>
            <Td className="text-zinc-500">{r.bill_number}</Td>
            <Td className="whitespace-nowrap text-zinc-500">{formatDate(r.created_at)}</Td>
            <Td>{r.customer_name || '—'}</Td>
            <Td>{r.items.length}</Td>
            <Td><Badge tone={r.mode === 'credit' ? 'success' : 'neutral'}>{r.mode === 'credit' ? 'Store credit' : r.payment_mode}</Badge></Td>
            <Td className="text-right font-medium tabular-nums text-zinc-900">{money(r.amount)}</Td>
            <Td><Button variant="ghost" size="xs" icon={Eye} onClick={e => { e.stopPropagation(); openReceipt(r.id) }}>View</Button></Td>
          </Tr>
        ))}
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} count={count} onChange={setPage} />

      <ReturnReceipt ret={receipt} onClose={() => { setReceipt(null); scanRef.current?.focus() }} />
    </div>
  )
}
