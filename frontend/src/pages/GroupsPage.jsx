import { useEffect, useState } from 'react'
import { getGroups, getGroup, createGroup, updateGroup, deleteGroup, assignGroupPermissions } from '../api/groups'
import { getPermissions } from '../api/permissions'
import ActionMenu from '../components/common/ActionMenu'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import GroupForm from '../components/forms/GroupForm'
import AssignPermissionsForm from '../components/forms/AssignPermissionsForm'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'

export default function GroupsPage() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [formData, setFormData] = useState({ name: '' })
  const [allPermissions, setAllPermissions] = useState([])
  const [selectedDetail, setSelectedDetail] = useState(null)

  useEffect(() => {
    getPermissions().then(r => setAllPermissions(r.data))
    fetchGroups()
  }, [])

  const fetchGroups = () => {
    setLoading(true)
    getGroups()
      .then(r => setGroups(r.data.results ?? r.data))
      .catch(() => setError('Failed to load groups.'))
      .finally(() => setLoading(false))
  }

  const openCreate = () => { setFormData({ name: '' }); setFieldErrors({}); setModal('create') }
  const openEdit = (g) => { setSelected(g); setFormData({ name: g.name }); setFieldErrors({}); setModal('edit') }
  const openDelete = (g) => { setSelected(g); setModal('delete') }
  const openPermissions = async (g) => {
    setSelected(g)
    const { data } = await getGroup(g.id)
    setSelectedDetail(data)
    setModal('permissions')
  }
  const closeModal = () => { setModal(null); setSelected(null); setSelectedDetail(null); setError(''); setFieldErrors({}) }

  const handleCreate = async () => {
    setSaving(true); setError(''); setFieldErrors({})
    try { await createGroup(formData); fetchGroups(); closeModal() }
    catch (e) {
      const name = e.response?.data?.name?.[0]
      if (name) setFieldErrors({ name })
      else setError('Failed to create group.')
    }
    finally { setSaving(false) }
  }

  const handleEdit = async () => {
    setSaving(true); setError(''); setFieldErrors({})
    try { await updateGroup(selected.id, formData); fetchGroups(); closeModal() }
    catch (e) {
      const name = e.response?.data?.name?.[0]
      if (name) setFieldErrors({ name })
      else setError('Failed to update group.')
    }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true)
    try { await deleteGroup(selected.id); fetchGroups(); closeModal() }
    catch { setError('Failed to delete group.') }
    finally { setSaving(false) }
  }

  const handleAssignPermissions = async (ids) => {
    setSaving(true)
    try { await assignGroupPermissions(selected.id, ids); fetchGroups(); closeModal() }
    catch { setError('Failed to assign permissions.') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Groups</h1>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New Group
        </button>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError('')} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Permissions', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No groups found</td></tr>
              )}
              {groups.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{g.name}</td>
                  <td className="px-4 py-3 text-gray-600">{g.permissions?.length ?? 0} permission{g.permissions?.length !== 1 ? 's' : ''}</td>
                  <td className="px-4 py-3">
                    <ActionMenu actions={[
                      { label: 'Edit', icon: '✏️', onClick: () => openEdit(g) },
                      { label: 'Assign Permissions', icon: '🔐', onClick: () => openPermissions(g) },
                      { label: 'Delete', icon: '🗑️', onClick: () => openDelete(g), variant: 'danger' },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modal === 'create'} onClose={closeModal} title="Create Group" size="sm">
        <ErrorAlert message={error} />
        <GroupForm data={formData} onChange={setFormData} errors={fieldErrors} />
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit Group" size="sm">
        <ErrorAlert message={error} />
        <GroupForm data={formData} onChange={setFormData} errors={fieldErrors} />
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={handleEdit} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={modal === 'delete'}
        onClose={closeModal}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete Group"
        message={`Delete group "${selected?.name}"?`}
      />

      <Modal isOpen={modal === 'permissions'} onClose={closeModal} title={`Permissions — ${selected?.name}`} size="xl">
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
