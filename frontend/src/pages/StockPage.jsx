import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Boxes, Download, History, Printer, Trash2 } from 'lucide-react'
import { getStockItems, removeStockItem } from '../api/inventory'
import useQuery, { asList } from '../hooks/useQuery'
import BarcodeLabel from '../components/inventory/BarcodeLabel'
import PrintBarcodes from '../components/inventory/PrintBarcodes'
import ActionMenu from '../components/common/ActionMenu'
import ConfirmDialog from '../components/common/ConfirmDialog'
import SearchInput from '../components/common/SearchInput'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader, { Toolbar } from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import SegmentedControl from '../components/ui/SegmentedControl'
import { Table, Td, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'
import { downloadCode128 } from '../utils/barcode'
import { variantLabel } from '../utils/variant'
import { moneyShort } from '../utils/format'

const STATUSES = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'sold', label: 'Sold' },
  { value: 'removed', label: 'Removed' },
  { value: 'all', label: 'All' },
]
const STATUS_BADGE = {
  in_stock: { tone: 'success', label: 'In stock' },
  sold: { tone: 'brand', label: 'Sold' },
  removed: { tone: 'neutral', label: 'Removed' },
}
const PAGE_SIZE = 20

export default function StockPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('in_stock')
  const [error, setError] = useState('')
  const [toRemove, setToRemove] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [printItems, setPrintItems] = useState(null)
  const toast = useToast()
  const navigate = useNavigate()
  const { data, loading, error: loadError, reload } = useQuery(() => getStockItems({ page, search, status }), `${page}|${search}|${status}`)
  const { rows: items, count } = asList(data)

  const handleRemove = async () => {
    setRemoving(true)
    try { await removeStockItem(toRemove.id); toast(`Unit ${toRemove.code} removed`); setToRemove(null); reload() }
    catch { setError('Failed to remove unit.') }
    finally { setRemoving(false) }
  }

  return (
    <div>
      <PageHeader title="Stock" subtitle="Every individual unit and its barcode."
        actions={<Button icon={Printer} onClick={() => setPrintItems(items)} disabled={items.length === 0}>Print labels on this page</Button>} />

      <Toolbar>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search code, product, color, size…" className="sm:w-80" />
        <SegmentedControl options={STATUSES} value={status} onChange={v => { setStatus(v); setPage(1) }} />
      </Toolbar>

      <ErrorAlert message={error || (loadError && 'Failed to load stock.')} onDismiss={() => setError('')} />

      <Table
        columns={[{ label: 'Product' }, { label: 'Code' }, { label: 'Category' }, { label: 'Price' }, { label: 'Barcode' }, { label: 'Status' }, { label: '', className: 'w-12' }]}
        loading={loading} isEmpty={items.length === 0}
        empty={{ icon: Boxes, title: 'No units found', description: search ? 'Try a different search or status.' : 'Add stock from the Products page — each unit gets its own barcode.' }}
      >
        {items.map(it => (
          <Tr key={it.id}>
            <Td>
              <Link to={`/stock/${it.code}`} className="font-medium text-zinc-900 hover:text-brand-700 hover:underline">{it.product_name}</Link>
              <div className="text-xs text-zinc-500">{variantLabel(it) || 'Default'}</div>
            </Td>
            <Td className="font-mono text-xs">{it.code}</Td>
            <Td className="text-zinc-500">{it.category_name || '—'}</Td>
            <Td className="tabular-nums">{moneyShort(it.price)}</Td>
            <Td><BarcodeLabel code={it.code} /></Td>
            <Td><Badge tone={STATUS_BADGE[it.status]?.tone} dot>{STATUS_BADGE[it.status]?.label ?? it.status}</Badge></Td>
            <Td className="text-right">
              <ActionMenu actions={[
                { label: 'View history', icon: History, onClick: () => navigate(`/stock/${it.code}`) },
                { label: 'Print label', icon: Printer, onClick: () => setPrintItems([it]) },
                { label: 'Download barcode', icon: Download, onClick: () => downloadCode128(it) },
                ...(it.status === 'in_stock'
                  ? [{ label: 'Remove from stock', icon: Trash2, onClick: () => setToRemove(it), variant: 'danger' }]
                  : []),
              ]} />
            </Td>
          </Tr>
        ))}
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} count={count} onChange={setPage} />

      <ConfirmDialog isOpen={!!toRemove} onClose={() => setToRemove(null)} onConfirm={handleRemove} loading={removing} confirmLabel="Remove"
        title="Remove stock unit" message={`Remove unit ${toRemove?.code}? It will no longer count as in stock.`} />

      <PrintBarcodes items={printItems} title="Stock barcodes" onClose={() => setPrintItems(null)} />
    </div>
  )
}
