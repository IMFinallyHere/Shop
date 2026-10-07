import { useState } from 'react'
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/inventory'
import useQuery, { asList } from '../hooks/useQuery'
import ActionMenu from '../components/common/ActionMenu'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { Field, Input } from '../components/ui/Field'
import { Table, Td, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'

export default function CategoriesPage() {
  const { data, loading, error: loadError, reload } = useQuery(() => getCategories())
  const items = asList(data).rows
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const toast = useToast()

  const openCreate = () => { setForm({ name: '', description: '' }); setFieldError(''); setModal('create') }
  const openEdit = (c) => { setSelected(c); setForm({ name: c.name, description: c.description }); setFieldError(''); setModal('edit') }
  const openDelete = (c) => { setSelected(c); setModal('delete') }
  const close = () => { setModal(null); setSelected(null); setError(''); setFieldError('') }

  const save = async () => {
    setSaving(true); setError(''); setFieldError('')
    try {
      await (modal === 'edit' ? updateCategory(selected.id, form) : createCategory(form))
      toast(modal === 'edit' ? 'Category updated' : 'Category created'); reload(); close()
    } catch (e) { setFieldError(e.response?.data?.name?.[0] || ''); if (!e.response?.data?.name) setError('Failed to save.') }
    finally { setSaving(false) }
  }
  const handleDelete = async () => {
    setSaving(true)
    try { await deleteCategory(selected.id); toast('Category deleted'); reload(); close() }
    catch { setError('Failed to delete.') } finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Categories" subtitle="Group products so they're easier to find."
        actions={<Button variant="primary" icon={Plus} onClick={openCreate}>New category</Button>} />
      <ErrorAlert message={error || (loadError && 'Failed to load categories.')} onDismiss={() => setError('')} />

      <Table
        columns={[{ label: 'Name' }, { label: 'Description' }, { label: 'Products' }, { label: '', className: 'w-12' }]}
        loading={loading} isEmpty={items.length === 0}
        empty={{ icon: FolderTree, title: 'No categories yet', description: 'Create categories like "Kurtis" or "Sarees" to organise products.',
          action: <Button variant="primary" icon={Plus} onClick={openCreate}>New category</Button> }}
      >
        {items.map(c => (
          <Tr key={c.id}>
            <Td className="font-medium text-zinc-900">{c.name}</Td>
            <Td className="text-zinc-500">{c.description || '—'}</Td>
            <Td><Badge>{c.product_count}</Badge></Td>
            <Td className="text-right">
              <ActionMenu actions={[
                { label: 'Edit', icon: Pencil, onClick: () => openEdit(c) },
                { label: 'Delete', icon: Trash2, onClick: () => openDelete(c), variant: 'danger' },
              ]} />
            </Td>
          </Tr>
        ))}
      </Table>

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={close} title={modal === 'edit' ? 'Edit category' : 'New category'} size="sm"
        footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save</Button></>}>
        <ErrorAlert message={error} />
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); save() }}>
          <Field label="Name" required error={fieldError}>
            {id => <Input id={id} autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} invalid={!!fieldError} />}
          </Field>
          <Field label="Description">
            {id => <Input id={id} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional" />}
          </Field>
          <button type="submit" hidden />
        </form>
      </Modal>

      <ConfirmDialog isOpen={modal === 'delete'} onClose={close} onConfirm={handleDelete} loading={saving}
        title="Delete category" message={`Delete "${selected?.name}"? Products keep existing but lose this category.`} />
    </div>
  )
}
