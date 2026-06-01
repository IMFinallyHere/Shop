import { useEffect, useState } from 'react'
import { getStockItems, removeStockItem } from '../api/inventory'
import BarcodeLabel from '../components/inventory/BarcodeLabel'
import PrintBarcodes from '../components/inventory/PrintBarcodes'
import ActionMenu from '../components/common/ActionMenu'
import ConfirmDialog from '../components/common/ConfirmDialog'
import SearchInput from '../components/common/SearchInput'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'
import { downloadCode128, downloadQR } from '../utils/barcode'

const STATUSES = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'sold', label: 'Sold' },
  { value: 'removed', label: 'Removed' },
  { value: 'all', label: 'All' },
]
const PAGE_SIZE = 20

export default function StockPage() {
  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('in_stock')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toRemove, setToRemove] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [printItems, setPrintItems] = useState(null)

  useEffect(() => { fetch() }, [page, search, status])

  const fetch = () => {
    setLoading(true)
    getStockItems({ page, search, status })
      .then(r => { setItems(r.data.results ?? r.data); setCount(r.data.count ?? 0) })
      .catch(() => setError('Failed to load stock.'))
      .finally(() => setLoading(false))
  }

  const handleRemove = async () => {
    setRemoving(true)
    try { await removeStockItem(toRemove.id); setToRemove(null); fetch() }
    catch { setError('Failed to remove unit.') }
    finally { setRemoving(false) }
  }

  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Stock</h1>
        <button onClick={() => setPrintItems(items)} disabled={items.length === 0}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">🖨 Print this page</button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1"><SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search by code or product…" /></div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError('')} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Code', 'Product', 'Category', 'Barcode', 'Status', 'Actions'].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No stock units</td></tr>}
              {items.map(it => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{it.code}</td>
                  <td className="px-4 py-3 text-gray-800">{it.product_name}</td>
                  <td className="px-4 py-3 text-gray-500">{it.category_name || '—'}</td>
                  <td className="px-4 py-3"><BarcodeLabel code={it.code} /></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${it.status === 'in_stock' ? 'bg-green-100 text-green-700' : it.status === 'sold' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {it.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActionMenu actions={[
                      { label: 'Download barcode', icon: '📊', onClick: () => downloadCode128(it) },
                      { label: 'Download QR', icon: '🔳', onClick: () => downloadQR(it) },
                      ...(it.status === 'in_stock'
                        ? [{ label: 'Remove', icon: '🗑️', onClick: () => setToRemove(it), variant: 'danger' }]
                        : []),
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

      <ConfirmDialog isOpen={!!toRemove} onClose={() => setToRemove(null)} onConfirm={handleRemove} loading={removing}
        title="Remove Stock Unit" message={`Remove unit ${toRemove?.code}? It will no longer count as in-stock.`} />

      <PrintBarcodes items={printItems} title="Stock barcodes" onClose={() => setPrintItems(null)} />
    </div>
  )
}
