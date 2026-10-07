import { useState } from 'react'
import { Users } from 'lucide-react'
import { getCustomers } from '../api/customers'
import useQuery, { asList } from '../hooks/useQuery'
import SearchInput from '../components/common/SearchInput'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader, { Toolbar } from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import { Table, Td, Tr } from '../components/ui/Table'
import { initials, money } from '../utils/format'

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const { data, loading, error } = useQuery(() => getCustomers({ search }), search)
  const customers = asList(data).rows

  return (
    <div>
      <PageHeader title="Customers" subtitle="People who have purchased from this shop." />
      <Toolbar><SearchInput value={search} onChange={setSearch} placeholder="Search by name or phone…" /></Toolbar>
      <ErrorAlert message={error && 'Failed to load customers.'} />

      <Table
        columns={[{ label: 'Customer' }, { label: 'Phone' }, { label: 'Email' }, { label: 'Purchases' }, { label: 'Store credit', className: 'text-right' }]}
        loading={loading} isEmpty={customers.length === 0}
        empty={{ icon: Users, title: search ? 'No matching customers' : 'No customers yet', description: search ? 'Try a different name or number.' : 'Customers are saved automatically when you create a bill.' }}
      >
        {customers.map(c => (
          <Tr key={c.id}>
            <Td>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{initials(c.name)}</span>
                <span className="font-medium text-zinc-900">{c.name}</span>
              </div>
            </Td>
            <Td className="tabular-nums">{c.phone}</Td>
            <Td className="text-zinc-500">{c.email || '—'}</Td>
            <Td>{c.bill_count}</Td>
            <Td className="text-right">
              {Number(c.credit_balance) > 0 ? <Badge tone="success">{money(c.credit_balance)}</Badge> : <span className="text-zinc-400">—</span>}
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  )
}
