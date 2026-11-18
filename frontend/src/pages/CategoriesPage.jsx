import { useState } from 'react'
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/inventory'
import useQuery, { asList } from '../hooks/useQuery'
import ActionMenu from '../components/common/ActionMenu'
import Modal from '../components/common/Modal'
import { useAuth } from '../contexts/AuthContext'
import { can } from '../utils/permissions'
import ConfirmDialog from '../components/common/ConfirmDialog'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import CategoryForm from '../components/forms/CategoryForm'
import { EMPTY_CATEGORY, parseApiErrors } from '../utils/inventoryForms'
import Pagination from '../components/ui/Pagination'
import { Table, Td, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'

const PAGE_SIZE = 20

export default function CategoriesPage() {
  const [page, setPage] = useState(1)
  const { data, loading, error: loadError, reload } = useQuery(() => getCategories({ page }), page)
  const { rows: items, count } = asList(data)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_CATEGORY)
  const toast = useToast()
  const { user } = useAuth()
  const canAdd = can(user, 'inventory.add_category')
  const canChange = can(user, 'inventory.change_category')
  const canDelete = can(user, 'inventory.delete_category')

  const openCreate = () => { setForm({ ...EMPTY_CATEGORY }); setFieldErrors({}); setModal('create') }
  const openEdit = (c) => { setSelected(c); setForm({ name: c.name, description: c.description }); setFieldErrors({}); setModal('edit') }
  const openDelete = (c) => { setSelected(c); setModal('delete') }
  const close = () => { setModal(null); setSelected(null); setError(''); setFieldErrors({}) }

  const save = async () => {
    setSaving(true); setError(''); setFieldErrors({})
    try {
      await (modal === 'edit' ? updateCategory(selected.id, form) : createCategory(form))
      toast(modal === 'edit' ? 'Category updated' : 'Category created'); reload(); close()
    } catch (e) { const { fields, general } = parseApiErrors(e); setFieldErrors(fields); setError(general) }
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
        actions={canAdd && <Button variant="primary" icon={Plus} onClick={openCreate}>New category</Button>} />
      <ErrorAlert message={error || (loadError && 'Failed to load categories.')} onDismiss={() => setError('')} />

      <Table
        columns={[{ label: 'Name' }, { label: 'Description' }, { label: 'Products' }, { label: '', className: 'w-12' }]}
        loading={loading} isEmpty={items.length === 0}
        empty={{ icon: FolderTree, title: 'No categories yet', description: 'Create categories like "Kurtis" or "Sarees" to organise products.',
          action: canAdd && <Button variant="primary" icon={Plus} onClick={openCreate}>New category</Button> }}
      >
        {items.map(c => (
          <Tr key={c.id}>
            <Td className="font-medium text-zinc-900">{c.name}</Td>
            <Td className="text-zinc-500">{c.description || '—'}</Td>
            <Td><Badge>{c.product_count}</Badge></Td>
            <Td className="text-right">
              <ActionMenu actions={[
                canChange && { label: 'Edit', icon: Pencil, onClick: () => openEdit(c) },
                canDelete && { label: 'Delete', icon: Trash2, onClick: () => openDelete(c), variant: 'danger' },
              ]} />
            </Td>
          </Tr>
        ))}
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} count={count} onChange={setPage} />

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={close} title={modal === 'edit' ? 'Edit category' : 'New category'} size="sm"
        footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save</Button></>}>
        <ErrorAlert message={error} />
        <CategoryForm form={form} onChange={setForm} errors={fieldErrors} onSubmit={save} />
      </Modal>

      <ConfirmDialog isOpen={modal === 'delete'} onClose={close} onConfirm={handleDelete} loading={saving}
        title="Delete category" message={`Delete "${selected?.name}"? Products keep existing but lose this category.`} />
    </div>
  )
}
