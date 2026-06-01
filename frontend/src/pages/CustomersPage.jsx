import { useEffect, useState } from 'react'
import { getCustomers } from '../api/customers'
import SearchInput from '../components/common/SearchInput'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetch() }, [search])

  const fetch = () => {
    setLoading(true)
    getCustomers({ search })
      .then(r => setCustomers(r.data))
      .catch(() => setError('Failed to load customers.'))
      .finally(() => setLoading(false))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Customers</h1>
      <p className="text-sm text-gray-500 mb-4">Customers who have purchased from this shop.</p>
      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search by name or phone…" /></div>
      <ErrorAlert message={error} onDismiss={() => setError('')} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Name', 'Phone', 'Email', 'Purchases'].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No customers yet</td></tr>}
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.bill_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
