import { useState } from 'react'
import { Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { getSellers, createSeller, updateSeller, deleteSeller } from '../api/inventory'
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
import SellerForm from '../components/forms/SellerForm'
import { EMPTY_SELLER as EMPTY, parseApiErrors, sellerBody, sellerErrors } from '../utils/inventoryForms'
import Pagination from '../components/ui/Pagination'
import { Table, Td, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'


const PAGE_SIZE = 20

export default function SellersPage() {
  const [page, setPage] = useState(1)
  const { data, loading, error: loadError, reload } = useQuery(() => getSellers({ page }), page)
  const { rows: items, count } = asList(data)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const toast = useToast()
  const { user } = useAuth()
  const canAdd = can(user, 'inventory.add_seller')
  const canChange = can(user, 'inventory.change_seller')
  const canDelete = can(user, 'inventory.delete_seller')

  const openCreate = () => { setForm({ ...EMPTY }); setFieldErrors({}); setModal('create') }
  const openEdit = (s) => { setSelected(s); setForm({ name: s.name, phones: s.phones?.length ? s.phones : [''], email: s.email, address: s.address, notes: s.notes }); setFieldErrors({}); setModal('edit') }
  const openDelete = (s) => { setSelected(s); setModal('delete') }
  const close = () => { setModal(null); setSelected(null); setError(''); setFieldErrors({}) }

  const save = async () => {
    const local = sellerErrors(form)
    if (Object.keys(local).length) { setFieldErrors(local); setError(''); return }
    setSaving(true); setError(''); setFieldErrors({})
    try {
      const body = sellerBody(form)
      await (modal === 'edit' ? updateSeller(selected.id, body) : createSeller(body))
      toast(modal === 'edit' ? 'Seller updated' : 'Seller added'); reload(); close()
    } catch (e) { const { fields, general } = parseApiErrors(e); setFieldErrors(fields); setError(general) }
    finally { setSaving(false) }
  }
  const handleDelete = async () => {
    setSaving(true)
    try { await deleteSeller(selected.id); toast('Seller deleted'); reload(); close() }
    catch { setError('Failed to delete.') } finally { setSaving(false) }
  }

  return (
    <div>
      <PageHeader title="Sellers" subtitle="Suppliers you buy stock from."
        actions={canAdd && <Button variant="primary" icon={Plus} onClick={openCreate}>New seller</Button>} />
      <ErrorAlert message={error || (loadError && 'Failed to load sellers.')} onDismiss={() => setError('')} />

      <Table
        columns={[{ label: 'Name' }, { label: 'Phone numbers' }, { label: 'Email' }, { label: 'Products' }, { label: '', className: 'w-12' }]}
        loading={loading} isEmpty={items.length === 0}
        empty={{ icon: Truck, title: 'No sellers yet', description: 'Add the suppliers you buy from to track where stock comes from.',
          action: canAdd && <Button variant="primary" icon={Plus} onClick={openCreate}>New seller</Button> }}
      >
        {items.map(s => (
          <Tr key={s.id}>
            <Td>
              <div className="font-medium text-zinc-900">{s.name}</div>
              {s.address && <div className="max-w-xs truncate text-xs text-zinc-500">{s.address}</div>}
            </Td>
            <Td className="tabular-nums">{s.phones?.length ? s.phones.map(n => <div key={n}>{n}</div>) : '—'}</Td>
            <Td className="text-zinc-500">{s.email || '—'}</Td>
            <Td><Badge>{s.product_count}</Badge></Td>
            <Td className="text-right">
              <ActionMenu actions={[
                canChange && { label: 'Edit', icon: Pencil, onClick: () => openEdit(s) },
                canDelete && { label: 'Delete', icon: Trash2, onClick: () => openDelete(s), variant: 'danger' },
              ]} />
            </Td>
          </Tr>
        ))}
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} count={count} onChange={setPage} />

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={close} title={modal === 'edit' ? 'Edit seller' : 'New seller'}
        footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save</Button></>}>
        <ErrorAlert message={error} />
        <SellerForm form={form} onChange={setForm} errors={fieldErrors} />
      </Modal>

      <ConfirmDialog isOpen={modal === 'delete'} onClose={close} onConfirm={handleDelete} loading={saving}
        title="Delete seller" message={`Delete "${selected?.name}"?`} />
    </div>
  )
}
