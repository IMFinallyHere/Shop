import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HandCoins, Users } from 'lucide-react'
import { getDues } from '../api/billing'
import { useAuth } from '../contexts/AuthContext'
import { can } from '../utils/permissions'
import useQuery from '../hooks/useQuery'
import SearchInput from '../components/common/SearchInput'
import ErrorAlert from '../components/common/ErrorAlert'
import ReceiveDueModal from '../components/billing/ReceiveDueModal'
import PageHeader, { Toolbar } from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import StatCard from '../components/ui/StatCard'
import { Table, Td, Tr } from '../components/ui/Table'
import { formatDate, initials, money } from '../utils/format'

// Customers who bought on credit and still owe the shop money.
export default function CreditPage() {
  const [search, setSearch] = useState('')
  const [receiving, setReceiving] = useState(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data, loading, error, reload } = useQuery(() => getDues({ search }), search)
  const rows = data?.results ?? []
  const canReceive = can(user, 'billing.add_duepayment')
  const biggest = rows[0]

  return (
    <div>
      <PageHeader title="Credit" subtitle="Customers who still owe this shop money for bills they only part-paid." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total owed" icon={HandCoins} loading={loading && !data} value={money(data?.total_outstanding ?? 0)} />
        <StatCard label="Customers owing" icon={Users} loading={loading && !data} value={data?.customers_owing ?? 0} />
        <StatCard label="Largest balance" icon={HandCoins} loading={loading && !data} value={biggest ? money(biggest.owed) : '—'} hint={biggest?.name} />
      </div>

      <Toolbar><SearchInput value={search} onChange={setSearch} placeholder="Search by name or phone…" /></Toolbar>
      <ErrorAlert message={error && 'Failed to load credit.'} />

      <Table
        columns={[{ label: 'Customer' }, { label: 'Phone' }, { label: 'Open bills' }, { label: 'Oldest bill' }, { label: 'Owes', className: 'text-right' }, { label: '', className: 'w-px' }]}
        loading={loading && !data} isEmpty={rows.length === 0}
        empty={{ icon: HandCoins, title: search ? 'No matching customers' : 'Nobody owes you anything',
          description: search ? 'Try a different name or number.' : 'When a customer pays only part of a bill, the rest shows up here.' }}
      >
        {rows.map(r => (
          <Tr key={r.customer_id} className="cursor-pointer" onClick={() => navigate(`/customers/${r.customer_id}`)}>
            <Td>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{initials(r.name)}</span>
                <span className="font-medium text-zinc-900">{r.name}</span>
              </div>
            </Td>
            <Td className="tabular-nums">{r.phone}</Td>
            <Td>{r.open_bills}</Td>
            <Td className="whitespace-nowrap text-zinc-500">{formatDate(r.oldest)}</Td>
            <Td className="text-right font-semibold tabular-nums text-amber-700">{money(r.owed)}</Td>
            <Td onClick={e => e.stopPropagation()}>
              {canReceive && <Button size="xs" variant="primary" onClick={() => setReceiving({ customer_id: r.customer_id, name: r.name, owed: r.owed })}>Receive</Button>}
            </Td>
          </Tr>
        ))}
      </Table>

      <ReceiveDueModal isOpen={!!receiving} customer={receiving} onClose={() => setReceiving(null)}
        onDone={() => { setReceiving(null); reload() }} />
    </div>
  )
}
