import { useState } from 'react'
import { Pencil, Plus, Trash2, Truck, X } from 'lucide-react'
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
import Pagination from '../components/ui/Pagination'
import { Table, Td, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'

const EMPTY = { name: '', phones: [''], email: '', address: '', notes: '' }
const MAX_PHONES = 6  // the API accepts up to 6 numbers per seller

const PAGE_SIZE = 20

export default function SellersPage() {
  const [page, setPage] = useState(1)
  const { data, loading, error: loadError, reload } = useQuery(() => getSellers({ page }), page)
  const { rows: items, count } = asList(data)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const toast = useToast()

  const openCreate = () => { setForm({ ...EMPTY }); setFieldError(''); setModal('create') }
  const openEdit = (s) => { setSelected(s); setForm({ name: s.name, phones: s.phones?.length ? s.phones : [''], email: s.email, address: s.address, notes: s.notes }); setFieldError(''); setModal('edit') }
  const openDelete = (s) => { setSelected(s); setModal('delete') }
  const close = () => { setModal(null); setSelected(null); setError(''); setFieldError('') }

  const save = async () => {
    setSaving(true); setError(''); setFieldError('')
    try {
      const body = { ...form, phones: form.phones.map(n => n.trim()).filter(Boolean) }  // blank rows are ignored
      await (modal === 'edit' ? updateSeller(selected.id, body) : createSeller(body))
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
  const setPhone = (i, v) => setForm({ ...form, phones: form.phones.map((n, j) => (j === i ? v : n)) })
  const removePhone = (i) => setForm({ ...form, phones: form.phones.length > 1 ? form.phones.filter((_, j) => j !== i) : [''] })

  return (
    <div>
      <PageHeader title="Sellers" subtitle="Suppliers you buy stock from."
        actions={<Button variant="primary" icon={Plus} onClick={openCreate}>New seller</Button>} />
      <ErrorAlert message={error || (loadError && 'Failed to load sellers.')} onDismiss={() => setError('')} />

      <Table
        columns={[{ label: 'Name' }, { label: 'Phone numbers' }, { label: 'Email' }, { label: 'Products' }, { label: '', className: 'w-12' }]}
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
            <Td className="tabular-nums">{s.phones?.length ? s.phones.map(n => <div key={n}>{n}</div>) : '—'}</Td>
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
      <Pagination page={page} pageSize={PAGE_SIZE} count={count} onChange={setPage} />

      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={close} title={modal === 'edit' ? 'Edit seller' : 'New seller'}
        footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save</Button></>}>
        <ErrorAlert message={error} />
        <div className="space-y-4">
          <Field label="Name" required error={fieldError}>
            {id => <Input id={id} autoFocus value={form.name} onChange={set('name')} invalid={!!fieldError} />}
          </Field>
          <div>
            <div className="mb-1.5 text-sm font-medium text-zinc-700">Phone numbers</div>
            <div className="space-y-2">
              {form.phones.map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input type="tel" value={n} onChange={e => setPhone(i, e.target.value)} maxLength={20}
                    placeholder={i === 0 ? 'Primary number' : 'Another number'} aria-label={`Phone number ${i + 1}`} />
                  <button type="button" onClick={() => removePhone(i)} aria-label={`Remove phone number ${i + 1}`}
                    className="rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"><X size={15} /></button>
                </div>
              ))}
            </div>
            {form.phones.length < MAX_PHONES && (
              <button type="button" onClick={() => setForm({ ...form, phones: [...form.phones, ''] })}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
                <Plus size={15} /> Add another number
              </button>
            )}
          </div>
          <Field label="Email">{id => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>
          <Field label="Address">{id => <Input id={id} value={form.address} onChange={set('address')} />}</Field>
          <Field label="Notes">{id => <Textarea id={id} rows={2} value={form.notes} onChange={set('notes')} />}</Field>
        </div>
      </Modal>

      <ConfirmDialog isOpen={modal === 'delete'} onClose={close} onConfirm={handleDelete} loading={saving}
        title="Delete seller" message={`Delete "${selected?.name}"?`} />
    </div>
  )
}
