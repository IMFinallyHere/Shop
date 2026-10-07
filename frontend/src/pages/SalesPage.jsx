import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Receipt, ScanBarcode, Undo2 } from 'lucide-react'
import { getBills, getBill } from '../api/billing'
import useQuery, { asList } from '../hooks/useQuery'
import BillReceipt from '../components/billing/BillReceipt'
import SearchInput from '../components/common/SearchInput'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader, { Toolbar } from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import { Table, Td, Tr } from '../components/ui/Table'
import { formatDateTime, money } from '../utils/format'

const PAGE_SIZE = 20

export default function SalesPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState(null)
  const navigate = useNavigate()
  const { data, loading, error: loadError } = useQuery(() => getBills({ page, search }), `${page}|${search}`)
  const { rows: bills, count } = asList(data)

  const openReceipt = (id) => getBill(id).then(r => setReceipt(r.data)).catch(() => setError('Failed to load bill.'))

  return (
    <div>
      <PageHeader title="Sales" subtitle="Every bill created at the counter."
        actions={<Button as={Link} to="/pos" variant="primary" icon={ScanBarcode}>New bill</Button>} />
      <Toolbar><SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search by customer…" /></Toolbar>
      <ErrorAlert message={error || (loadError && 'Failed to load sales.')} onDismiss={() => setError('')} />

      <Table
        columns={[{ label: 'Bill' }, { label: 'Date' }, { label: 'Customer' }, { label: 'Items' }, { label: 'Payment' }, { label: 'Total', className: 'text-right' }, { label: '', className: 'w-px' }]}
        loading={loading} isEmpty={bills.length === 0}
        empty={{ icon: Receipt, title: search ? 'No matching bills' : 'No sales yet', description: search ? 'Try a different customer name.' : 'Bills appear here once you check out at the counter.' }}
      >
        {bills.map(b => (
          <Tr key={b.id} className="cursor-pointer" onClick={() => openReceipt(b.id)}>
            <Td className="font-medium text-zinc-900">{b.number}</Td>
            <Td className="whitespace-nowrap text-zinc-500">{formatDateTime(b.created_at)}</Td>
            <Td>{b.customer_name || '—'}</Td>
            <Td>{b.items?.length ?? '—'}</Td>
            <Td><Badge>{b.payment_mode}</Badge></Td>
            <Td className="text-right">
              <div className="font-medium tabular-nums text-zinc-900">{money(b.total)}</div>
              <ReturnBadge bill={b} />
            </Td>
            <Td onClick={e => e.stopPropagation()}>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="xs" icon={Eye} onClick={() => openReceipt(b.id)}>View</Button>
                {b.items?.some(i => !i.returned) && (
                  <Button variant="ghost" size="xs" icon={Undo2} onClick={() => navigate(`/returns?bill=${b.id}`)}>Return</Button>
                )}
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} count={count} onChange={setPage} />

      <BillReceipt bill={receipt} onClose={() => setReceipt(null)} />
    </div>
  )
}

function ReturnBadge({ bill }) {
  const refunded = Number(bill.refunded_total || 0)
  if (refunded <= 0) return null
  const full = bill.items?.every(i => i.returned)
  return <Badge tone={full ? 'danger' : 'warning'} className="mt-1">{full ? 'Returned' : 'Partly returned'}</Badge>
}
