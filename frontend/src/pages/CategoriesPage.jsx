import { useEffect, useState } from 'react'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/inventory'
import ActionMenu from '../components/common/ActionMenu'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'

export default function CategoriesPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })

  const fetch = () => {
    setLoading(true)
    getCategories().then(r => setItems(r.data.results ?? r.data)).catch(() => setError('Failed to load categories.')).finally(() => setLoading(false))
  }
  useEffect(() => { fetch() }, [])

  const openCreate = () => { setForm({ name: '', description: '' }); setFieldError(''); setModal('create') }
  const openEdit = (c) => { setSelected(c); setForm({ name: c.name, description: c.description }); setFieldError(''); setModal('edit') }
  const openDelete = (c) => { setSelected(c); setModal('delete') }
  const close = () => { setModal(null); setSelected(null); setError(''); setFieldError('') }

  const save = async (fn) => {
    setSaving(true); setError(''); setFieldError('')
    try { await fn(); fetch(); close() }
    catch (e) { setFieldError(e.response?.data?.name?.[0] || ''); if (!e.response?.data?.name) setError('Failed to save.') }
    finally { setSaving(false) }
  }
  const handleDelete = async () => {
    setSaving(true)
    try { await deleteCategory(selected.id); fetch(); close() }
    catch { setError('Failed to delete.') } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Categories</h1>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">+ New Category</button>
      </div>
      <ErrorAlert message={error} onDismiss={() => setError('')} />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Name', 'Description', 'Products', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No categories</td></tr>}
              {items.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.description || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.product_count}</td>
                  <td className="px-4 py-3">
                    <ActionMenu actions={[
                      { label: 'Edit', icon: '✏️', onClick: () => openEdit(c) },
                      { label: 'Delete', icon: '🗑️', onClick: () => openDelete(c), variant: 'danger' },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={close} title={modal === 'edit' ? 'Edit Category' : 'New Category'} size="sm">
        <ErrorAlert message={error} />
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name<span className="text-red-500 ml-1">*</span></label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${fieldError ? 'border-red-400' : 'border-gray-300'}`} />
            {fieldError && <p className="mt-1 text-xs text-red-600">{fieldError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={close} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={() => save(() => modal === 'edit' ? updateCategory(selected.id, form) : createCategory(form))} disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>

      <ConfirmDialog isOpen={modal === 'delete'} onClose={close} onConfirm={handleDelete} loading={saving}
        title="Delete Category" message={`Delete "${selected?.name}"? Products keep existing but lose this category.`} />
    </div>
  )
}
