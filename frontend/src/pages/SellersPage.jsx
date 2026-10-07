import { useState } from 'react'
import { Pencil, Plus, Trash2, Truck } from 'lucide-react'
import { getSellers, createSeller, updateSeller, deleteSeller } from '../api/inventory'
import useQuery, { asList } from '../hooks/useQuery'
import ActionMenu from '../components/common/ActionMenu'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { Field, Input, Textarea } from '../components/ui/Field'
import { Table, Td, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'

const EMPTY = { name: '', phone: '', email: '', address: '', notes: '' }

export default function SellersPage() {
  const { data, loading, error: loadError, reload } = useQuery(() => getSellers())
  const items = asList(data).rows
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const toast = useToast()

  const openCreate = () => { setForm({ ...EMPTY }); setFieldError(''); setModal('create') }
  const openEdit = (s) => { setSelected(s); setForm({ name: s.name, phone: s.phone, email: s.email, address: s.address, notes: s.notes }); setFieldError(''); setModal('edit') }
  const openDelete = (s) => { setSelected(s); setModal('delete') }
  const close = () => { setModal(null); setSelected(null); setError(''); setFieldError('') }

  const save = async () => {
    setSaving(true); setError(''); setFieldError('')
    try {
      await (modal === 'edit' ? updateSeller(selected.id, form) : createSeller(form))
      toast(modal === 'edit' ? 'Seller updated' : 'Seller added'); reload(); close()
    } catch (e) { setFieldError(e.response?.data?.name?.[0] || ''); if (!e.response?.data?.name) setError('Failed to save.') }
    finally { setSaving(false) }
  }
  const handleDelete = async () => {
    setSaving(true)
    try { await deleteSeller(selected.id); toast('Seller deleted'); reload(); close() }
    catch { setError('Failed to delete.') } finally { setSaving(false) }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div>
      <PageHeader title="Sellers" subtitle="Suppliers you buy stock from."
        actions={<Button variant="primary" icon={Plus} onClick={openCreate}>New seller</Button>} />
      <ErrorAlert message={error || (loadError && 'Failed to load sellers.')} onDismiss={() => setError('')} />

      <Table
        columns={[{ label: 'Name' }, { label: 'Phone' }, { label: 'Email' }, { label: 'Products' }, { label: '', className: 'w-12' }]}
        loading={loading} isEmpty={items.length === 0}
        empty={{ icon: Truck, title: 'No sellers yet', description: 'Add the suppliers you buy from to track where stock comes from.',
          action: <Button variant="primary" icon={Plus} onClick={openCreate}>New seller</Button> }}
      >
        {items.map(s => (
          <Tr key={s.id}>
            <Td>
              <div className="font-medium text-zinc-900">{s.name}</div>
              {s.address && <div className="max-w-xs truncate text-xs text-zinc-500">{s.address}</div>}
            </Td>
            <Td className="tabular-nums">{s.phone || '—'}</Td>
            <Td className="text-zinc-500">{s.email || '—'}</Td>
            <Td><Badge>{s.product_count}</Badge></Td>
            <Td className="text-right">
              <ActionMenu actions={[
                { label: 'Edit', icon: Pencil, onClick: () => openEdit(s) },
                { label: 'Delete', icon: Trash2, onClick: () => openDelete(s), variant: 'danger' },
              ]} />
            </Td>
          </Tr>
        ))}
      </Table>

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={close} title={modal === 'edit' ? 'Edit seller' : 'New seller'}
        footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save</Button></>}>
        <ErrorAlert message={error} />
        <div className="space-y-4">
          <Field label="Name" required error={fieldError}>
            {id => <Input id={id} autoFocus value={form.name} onChange={set('name')} invalid={!!fieldError} />}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone">{id => <Input id={id} type="tel" value={form.phone} onChange={set('phone')} />}</Field>
            <Field label="Email">{id => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>
          </div>
          <Field label="Address">{id => <Input id={id} value={form.address} onChange={set('address')} />}</Field>
          <Field label="Notes">{id => <Textarea id={id} rows={2} value={form.notes} onChange={set('notes')} />}</Field>
        </div>
      </Modal>

      <ConfirmDialog isOpen={modal === 'delete'} onClose={close} onConfirm={handleDelete} loading={saving}
        title="Delete seller" message={`Delete "${selected?.name}"?`} />
    </div>
  )
}
