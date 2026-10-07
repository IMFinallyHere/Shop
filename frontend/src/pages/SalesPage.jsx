import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBills, getBill } from '../api/billing'
import BillReceipt from '../components/billing/BillReceipt'
import SearchInput from '../components/common/SearchInput'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'

const money = (v) => `₹${Number(v).toFixed(2)}`
const PAGE_SIZE = 20

export default function SalesPage() {
  const [bills, setBills] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { fetch() }, [page, search])

  const fetch = () => {
    setLoading(true)
    getBills({ page, search })
      .then(r => { setBills(r.data.results ?? r.data); setCount(r.data.count ?? 0) })
      .catch(() => setError('Failed to load sales.'))
      .finally(() => setLoading(false))
  }

  const openReceipt = (id) => getBill(id).then(r => setReceipt(r.data)).catch(() => setError('Failed to load bill.'))
  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Sales</h1>
      <div className="mb-4"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search by customer…" /></div>
      <ErrorAlert message={error} onDismiss={() => setError('')} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Bill', 'Date', 'Customer', 'Items', 'Payment', 'Total', ''].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bills.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No sales yet</td></tr>}
              {bills.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{b.number}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(b.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-600">{b.customer_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{b.items?.length ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{b.payment_mode?.toUpperCase()}</td>
                  <td className="px-4 py-3 text-gray-800">
                    {money(b.total)}
                    <ReturnBadge bill={b} />
                  </td>
                  <td className="px-4 py-3 space-x-3 whitespace-nowrap">
                    <button onClick={() => openReceipt(b.id)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">View / Print</button>
                    {b.items?.some(i => !i.returned) && (
                      <button onClick={() => navigate(`/returns?bill=${b.id}`)} className="text-xs font-medium text-amber-600 hover:text-amber-800">Return</button>
                    )}
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

      <BillReceipt bill={receipt} onClose={() => setReceipt(null)} />
    </div>
  )
}

function ReturnBadge({ bill }) {
  const refunded = Number(bill.refunded_total || 0)
  if (refunded <= 0) return null
  const full = bill.items?.every(i => i.returned)
  return (
    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${full ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
      {full ? 'Returned' : 'Partly returned'}
    </span>
  )
}
