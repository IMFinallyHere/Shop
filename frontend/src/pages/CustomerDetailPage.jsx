import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, IndianRupee, Mail, Phone, Receipt, Undo2, Users, Wallet } from 'lucide-react'
import { getCustomer } from '../api/customers'
import useQuery from '../hooks/useQuery'
import useReceipts from '../hooks/useReceipts'
import Spinner from '../components/common/Spinner'
import BackLink from '../components/ui/BackLink'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import StatCard from '../components/ui/StatCard'
import { Table, Td, Tr } from '../components/ui/Table'
import { formatDate, formatDateTime, initials, money } from '../utils/format'

export default function CustomerDetailPage() {
  const { id } = useParams()
  const { data: c, loading, error } = useQuery(() => getCustomer(id), id)
  const { openBill, openReturn, receipts } = useReceipts()

  if (loading) return <Spinner />
  if (error) {
    return (
      <Card>
        <EmptyState icon={Users} title="Customer not found" description="They haven't bought anything from this shop."
          action={<Button as={Link} to="/customers" icon={ArrowLeft}>All customers</Button>} />
      </Card>
    )
  }
  const s = c.stats

  return (
    <div>
      <BackLink fallback="/customers" label="Customers" />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">{initials(c.name)}</span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{c.name}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
            <span className="flex items-center gap-1.5"><Phone size={14} />{c.phone}</span>
            {c.email && <span className="flex items-center gap-1.5"><Mail size={14} />{c.email}</span>}
            <span>Customer since {formatDate(s.first_visit)} · last visit {formatDate(s.last_visit)}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Bills" icon={Receipt} value={s.bills} />
        <StatCard label="Total spent" icon={IndianRupee} value={money(s.spent)} />
        <StatCard label="Refunded" icon={Undo2} value={money(s.refunded)} />
        <StatCard label="Store credit" icon={Wallet} value={money(s.credit_balance)} />
      </div>

      <h2 className="mb-3 text-base font-semibold text-zinc-900">Bills</h2>
      <Table className="mb-8"
        columns={[{ label: 'Bill' }, { label: 'Date' }, { label: 'Items' }, { label: 'Payment' }, { label: 'Total', className: 'text-right' }]}
        isEmpty={c.bills.length === 0} empty={{ icon: Receipt, title: 'No bills' }}>
        {c.bills.map(b => (
          <Tr key={b.id} className="cursor-pointer" onClick={() => openBill(b.id)}>
            <Td className="font-medium text-zinc-900">{b.number} {b.returned && <Badge tone="warning" className="ml-1">Returns</Badge>}</Td>
            <Td className="text-zinc-500">{formatDateTime(b.created_at)}</Td>
            <Td>{b.items}</Td>
            <Td><Badge>{b.payment_mode}</Badge></Td>
            <Td className="text-right font-medium tabular-nums text-zinc-900">{money(b.total)}</Td>
          </Tr>
        ))}
      </Table>

      {c.returns.length > 0 && (<>
        <h2 className="mb-3 text-base font-semibold text-zinc-900">Returns</h2>
        <Table className="mb-8"
          columns={[{ label: 'Return' }, { label: 'From bill' }, { label: 'Date' }, { label: 'Items' }, { label: 'Settled' }, { label: 'Amount', className: 'text-right' }]}>
          {c.returns.map(r => (
            <Tr key={r.id} className="cursor-pointer" onClick={() => openReturn(r.id)}>
              <Td className="font-medium text-zinc-900">
                {r.number}
                {r.reason && <div className="text-xs font-normal text-zinc-500">“{r.reason}”</div>}
              </Td>
              <Td className="text-zinc-500">{r.bill_number}</Td>
              <Td className="text-zinc-500">{formatDateTime(r.created_at)}</Td>
              <Td>{r.items}</Td>
              <Td><Badge tone={r.mode === 'credit' ? 'success' : 'neutral'}>{r.mode === 'credit' ? 'Store credit' : r.payment_mode}</Badge></Td>
              <Td className="text-right font-medium tabular-nums text-zinc-900">{money(r.amount)}</Td>
            </Tr>
          ))}
        </Table>
      </>)}

      {c.credit.length > 0 && (
        <Card className="max-w-xl">
          <CardHeader title="Store credit history" subtitle={`Balance ${money(s.credit_balance)}`} />
          <ul className="divide-y divide-zinc-100">
            {c.credit.map(e => (
              <li key={e.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-zinc-600">{Number(e.amount) > 0 ? 'Credited' : 'Used'} · {e.ref} <span className="text-xs text-zinc-400">{formatDate(e.created_at)}</span></span>
                <span className={`font-medium tabular-nums ${Number(e.amount) > 0 ? 'text-emerald-700' : 'text-zinc-700'}`}>
                  {Number(e.amount) > 0 ? '+' : '−'}{money(Math.abs(Number(e.amount)))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {receipts}
    </div>
  )
}
