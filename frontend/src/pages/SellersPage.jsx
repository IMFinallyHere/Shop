import { useEffect, useState } from 'react'
import { getSellers, createSeller, updateSeller, deleteSeller } from '../api/inventory'
import ActionMenu from '../components/common/ActionMenu'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'

const EMPTY = { name: '', phone: '', email: '', address: '', notes: '' }

export default function SellersPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY)

  const fetch = () => {
    setLoading(true)
    getSellers().then(r => setItems(r.data.results ?? r.data)).catch(() => setError('Failed to load sellers.')).finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [])

  const openCreate = () => { setForm({ ...EMPTY }); setFieldError(''); setModal('create') }
  const openEdit = (s) => { setSelected(s); setForm({ name: s.name, phone: s.phone, email: s.email, address: s.address, notes: s.notes }); setFieldError(''); setModal('edit') }
  const openDelete = (s) => { setSelected(s); setModal('delete') }
  const close = () => { setModal(null); setSelected(null); setError(''); setFieldError('') }

  const save = async (fn) => {
    setSaving(true); setError(''); setFieldError('')
    try { await fn(); fetch(); close() }
    catch (e) { setFieldError(e.response?.data?.name?.[0] || ''); if (!e.response?.data?.name) setError('Failed to save.') }
    finally { setSaving(false) }
  }
  const handleDelete = async () => {
    setSaving(true)
    try { await deleteSeller(selected.id); fetch(); close() }
    catch { setError('Failed to delete.') } finally { setSaving(false) }
  }

  const fld = (name, label, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{name === 'name' && <span className="text-red-500 ml-1">*</span>}</label>
      <input type={type} value={form[name]} onChange={e => setForm({ ...form, [name]: e.target.value })} required={name === 'name'}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${name === 'name' && fieldError ? 'border-red-400' : 'border-gray-300'}`} />
      {name === 'name' && fieldError && <p className="mt-1 text-xs text-red-600">{fieldError}</p>}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Sellers</h1>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ New Seller</button>
      </div>
      <ErrorAlert message={error} onDismiss={() => setError('')} />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Name', 'Phone', 'Email', 'Products', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No sellers</td></tr>}
              {items.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.product_count}</td>
                  <td className="px-4 py-3">
                    <ActionMenu actions={[
                      { label: 'Edit', icon: '✏️', onClick: () => openEdit(s) },
                      { label: 'Delete', icon: '🗑️', onClick: () => openDelete(s), variant: 'danger' },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={close} title={modal === 'edit' ? 'Edit Seller' : 'New Seller'} size="md">
        <ErrorAlert message={error} />
        <div className="space-y-3">
          {fld('name', 'Name')}
          <div className="grid grid-cols-2 gap-3">{fld('phone', 'Phone')}{fld('email', 'Email', 'email')}</div>
          {fld('address', 'Address')}
          {fld('notes', 'Notes')}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={close} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={() => save(() => modal === 'edit' ? updateSeller(selected.id, form) : createSeller(form))} disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>

      <ConfirmDialog isOpen={modal === 'delete'} onClose={close} onConfirm={handleDelete} loading={saving}
        title="Delete Seller" message={`Delete "${selected?.name}"?`} />
    </div>
  )
}
