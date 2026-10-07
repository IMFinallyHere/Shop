import { useEffect, useState } from 'react'
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { getGroups, getGroup, createGroup, updateGroup, deleteGroup, assignGroupPermissions } from '../api/groups'
import { getPermissions } from '../api/permissions'
import useQuery, { asList } from '../hooks/useQuery'
import ActionMenu from '../components/common/ActionMenu'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import GroupForm from '../components/forms/GroupForm'
import AssignPermissionsForm from '../components/forms/AssignPermissionsForm'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { Table, Td, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'

export default function GroupsPage() {
  const { data, loading, error: loadError, reload } = useQuery(() => getGroups())
  const groups = asList(data).rows
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [formData, setFormData] = useState({ name: '' })
  const [allPermissions, setAllPermissions] = useState([])
  const [selectedDetail, setSelectedDetail] = useState(null)
  const toast = useToast()

  useEffect(() => { getPermissions().then(r => setAllPermissions(r.data)) }, [])

  const openCreate = () => { setFormData({ name: '' }); setFieldErrors({}); setModal('create') }
  const openEdit = (g) => { setSelected(g); setFormData({ name: g.name }); setFieldErrors({}); setModal('edit') }
  const openDelete = (g) => { setSelected(g); setModal('delete') }
  const openPermissions = async (g) => {
    setSelected(g)
    try {
      const { data } = await getGroup(g.id)
      setSelectedDetail(data)
      setModal('permissions')
    } catch { setError('Failed to load group.') }
  }
  const closeModal = () => { setModal(null); setSelected(null); setSelectedDetail(null); setError(''); setFieldErrors({}) }

  const save = async (fn, success, fallback) => {
    setSaving(true); setError(''); setFieldErrors({})
    try { await fn(); reload(); closeModal(); toast(success) }
    catch (e) {
      const name = e.response?.data?.name?.[0]
      if (name) setFieldErrors({ name })
      else setError(fallback)
    }
    finally { setSaving(false) }
  }

  const handleCreate = () => save(() => createGroup(formData), 'Group created', 'Failed to create group.')
  const handleEdit = () => save(() => updateGroup(selected.id, formData), 'Group updated', 'Failed to update group.')

  const handleDelete = async () => {
    setSaving(true)
    try { await deleteGroup(selected.id); reload(); closeModal(); toast('Group deleted') }
    catch { setError('Failed to delete group.') }
    finally { setSaving(false) }
  }

  const handleAssignPermissions = async (ids) => {
    setSaving(true)
    try { await assignGroupPermissions(selected.id, ids); reload(); closeModal(); toast('Permissions updated') }
    catch { setError('Failed to assign permissions.') }
    finally { setSaving(false) }
  }

  const footer = (onSave, label) => <>
    <Button onClick={closeModal}>Cancel</Button>
    <Button variant="primary" onClick={onSave} loading={saving}>{label}</Button>
  </>

  return (
    <div>
      <PageHeader title="Groups" subtitle="Bundle permissions into roles like Cashier or Manager, then assign them to users."
        actions={<Button variant="primary" icon={Plus} onClick={openCreate}>New group</Button>} />
      <ErrorAlert message={(!modal && error) || (loadError && 'Failed to load groups.')} onDismiss={() => setError('')} />

      <Table
        columns={[{ label: 'Name' }, { label: 'Permissions' }, { label: '', className: 'w-12' }]}
        loading={loading} isEmpty={groups.length === 0}
        empty={{ icon: ShieldCheck, title: 'No groups yet', description: 'Create a group to give several users the same permissions.',
          action: <Button variant="primary" icon={Plus} onClick={openCreate}>New group</Button> }}
      >
        {groups.map(g => (
          <Tr key={g.id}>
            <Td className="font-medium text-zinc-900">{g.name}</Td>
            <Td>
              <button onClick={() => openPermissions(g)} className="hover:underline">
                <Badge>{g.permissions?.length ?? 0} permission{g.permissions?.length !== 1 ? 's' : ''}</Badge>
              </button>
            </Td>
            <Td className="text-right">
              <ActionMenu actions={[
                { label: 'Edit', icon: Pencil, onClick: () => openEdit(g) },
                { label: 'Assign permissions', icon: ShieldCheck, onClick: () => openPermissions(g) },
                { label: 'Delete', icon: Trash2, onClick: () => openDelete(g), variant: 'danger' },
              ]} />
            </Td>
          </Tr>
        ))}
      </Table>

      <Modal isOpen={modal === 'create'} onClose={closeModal} title="New group" size="sm" footer={footer(handleCreate, 'Create')}>
        <ErrorAlert message={error} />
        <GroupForm data={formData} onChange={setFormData} errors={fieldErrors} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit group" size="sm" footer={footer(handleEdit, 'Save')}>
        <ErrorAlert message={error} />
        <GroupForm data={formData} onChange={setFormData} errors={fieldErrors} />
      </Modal>

      <ConfirmDialog isOpen={modal === 'delete'} onClose={closeModal} onConfirm={handleDelete} loading={saving}
        title="Delete group" message={`Delete group "${selected?.name}"?`} />

      <Modal isOpen={modal === 'permissions'} onClose={closeModal} title="Group permissions" description={selected?.name} size="xl">
        <ErrorAlert message={error} />
        <AssignPermissionsForm
          allPermissions={allPermissions}
          currentIds={(selectedDetail?.permissions ?? []).map(p => p.id)}
          onSave={handleAssignPermissions}
          onCancel={closeModal}
          loading={saving}
        />
      </Modal>
    </div>
  )
}
