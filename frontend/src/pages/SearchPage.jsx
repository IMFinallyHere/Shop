import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { search } from '../api/search'
import useQuery from '../hooks/useQuery'
import useReceipts from '../hooks/useReceipts'
import ErrorAlert from '../components/common/ErrorAlert'
import Spinner from '../components/common/Spinner'
import PageHeader from '../components/ui/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ResultRow from '../components/search/ResultRow'
import { groupResults, targetPath } from '../components/search/results'

export default function SearchPage() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const navigate = useNavigate()
  const { openBill, openReturn, receipts } = useReceipts()
  const { data, loading, error } = useQuery(() => search(q), q)
  const groups = groupResults(data)

  const go = (t) => (t.type === 'bill' ? openBill(t.id) : t.type === 'return' ? openReturn(t.id) : navigate(targetPath(t)))

  return (
    <div className="max-w-3xl">
      <PageHeader title="Search" subtitle={q ? <>Results for <span className="font-medium text-zinc-700">“{q}”</span></> : 'Type in the search box at the top.'} />
      <ErrorAlert message={error && 'Search failed.'} />
      {loading ? <Spinner /> : groups.length === 0 ? (
        <Card><EmptyState icon={Search} title={`No matches for “${q}”`} description="Try a barcode, bill number (INV-00012), return number, phone, customer, product or seller name." /></Card>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <Card key={g.key}>
              <CardHeader title={g.label} subtitle={`${g.items.length} shown`} />
              <div className="p-1.5">
                {g.items.map(item => <ResultRow key={item.id} item={item} icon={g.icon} onSelect={() => go(item.target)} />)}
              </div>
            </Card>
          ))}
        </div>
      )}
      {receipts}
    </div>
  )
}
