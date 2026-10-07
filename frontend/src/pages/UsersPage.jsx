import { useEffect, useState } from 'react'
import { KeyRound, Pencil, Plus, ShieldCheck, Tags, Trash2, UserCog } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser, changePassword, assignGroups, assignUserPermissions } from '../api/users'
import { getGroups } from '../api/groups'
import { getPermissions } from '../api/permissions'
import useQuery, { asList } from '../hooks/useQuery'
import ActionMenu from '../components/common/ActionMenu'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import UserForm from '../components/forms/UserForm'
import ChangePasswordForm from '../components/forms/ChangePasswordForm'
import AssignPermissionsForm from '../components/forms/AssignPermissionsForm'
import SearchInput from '../components/common/SearchInput'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader, { Toolbar } from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { Checkbox } from '../components/ui/Field'
import Pagination from '../components/ui/Pagination'
import { Table, Td, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'
import { displayName, initials } from '../utils/format'

const EMPTY_USER = { email: '', first_name: '', last_name: '', password: '', is_staff: false }
const PAGE_SIZE = 20

export default function UsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [formData, setFormData] = useState(EMPTY_USER)
  const [fieldErrors, setFieldErrors] = useState({})
  const [pwData, setPwData] = useState({ old_password: '', new_password: '' })
  const [allGroups, setAllGroups] = useState([])
  const [allPermissions, setAllPermissions] = useState([])
  const [selectedGroupIds, setSelectedGroupIds] = useState([])
  const toast = useToast()

  const { data, loading, error: loadError, reload } = useQuery(() => getUsers({ page, search }), `${page}|${search}`)
  const { rows: users, count } = asList(data)

  useEffect(() => {
    getGroups().then(r => setAllGroups(r.data.results ?? r.data))
    getPermissions().then(r => setAllPermissions(r.data))
  }, [])

  const openCreate = () => { setFormData({ ...EMPTY_USER }); setFieldErrors({}); setModal('create') }
  const openEdit = (u) => { setSelected(u); setFormData({ email: u.email, first_name: u.first_name, last_name: u.last_name, is_staff: u.is_staff }); setFieldErrors({}); setModal('edit') }
  const openDelete = (u) => { setSelected(u); setModal('delete') }
  const openPassword = (u) => { setSelected(u); setPwData({ old_password: '', new_password: '' }); setFieldErrors({}); setModal('password') }
  const openGroups = (u) => { setSelected(u); setSelectedGroupIds(u.groups); setModal('groups') }
  const openPermissions = (u) => { setSelected(u); setModal('permissions') }
  const closeModal = () => { setModal(null); setSelected(null); setError(''); setFieldErrors({}) }

  const parseFieldErrors = (responseData, knownFields = ['email', 'first_name', 'last_name', 'password', 'is_staff']) => {
    const fields = {}
    let general = ''
    Object.entries(responseData || {}).forEach(([key, val]) => {
      const msg = Array.isArray(val) ? val[0] : val
      if (knownFields.includes(key)) fields[key] = msg
      else general += (general ? ' ' : '') + msg
    })
    return { fields, general }
  }

  // Run a form submit: on success reload + toast; on failure split field vs general errors.
  const submit = async (fn, success, fallback, knownFields) => {
    setSaving(true); setError(''); setFieldErrors({})
    try { await fn(); reload(); closeModal(); toast(success) }
    catch (e) {
      const { fields, general } = parseFieldErrors(e.response?.data, knownFields)
      setFieldErrors(fields)
      setError(general || (Object.keys(fields).length === 0 ? fallback : ''))
    }
    finally { setSaving(false) }
  }

  const handleCreate = () => submit(() => createUser(formData), 'User added', 'Failed to create user.')
  const handleEdit = () => submit(() => updateUser(selected.id, formData), 'User updated', 'Failed to update user.')
  const handlePassword = () => submit(() => changePassword(selected.id, pwData), 'Password changed', 'Failed to change password.', ['old_password', 'new_password'])

  const handleDelete = async () => {
    setSaving(true)
    try { await deleteUser(selected.id); reload(); closeModal(); toast('User removed') }
    catch (e) { setError(e.response?.data?.detail || 'Failed to delete user.') }
    finally { setSaving(false) }
  }

  const handleAssignGroups = async () => {
    setSaving(true)
    try { await assignGroups(selected.id, selectedGroupIds); reload(); closeModal(); toast('Groups updated') }
    catch { setError('Failed to assign groups.') }
    finally { setSaving(false) }
  }

  const handleAssignPermissions = async (ids) => {
    setSaving(true)
    try { await assignUserPermissions(selected.id, ids); reload(); closeModal(); toast('Permissions updated') }
    catch { setError('Failed to assign permissions.') }
    finally { setSaving(false) }
  }

  const footer = (onSave, label) => <>
    <Button onClick={closeModal}>Cancel</Button>
    <Button variant="primary" onClick={onSave} loading={saving}>{label}</Button>
  </>

  return (
    <div>
      <PageHeader title="Users" subtitle="People who can sign in to this shop."
        actions={<Button variant="primary" icon={Plus} onClick={openCreate}>Add user</Button>} />
      <Toolbar><SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search users…" /></Toolbar>
      <ErrorAlert message={(!modal && error) || (loadError && 'Failed to load users.')} onDismiss={() => setError('')} />

      <Table
        columns={[{ label: 'User' }, { label: 'Role' }, { label: 'Status' }, { label: 'Groups' }, { label: '', className: 'w-12' }]}
        loading={loading} isEmpty={users.length === 0}
        empty={{ icon: UserCog, title: 'No users found', description: search ? 'Try a different search.' : 'Add staff so they can sign in and bill.' }}
      >
        {users.map(u => {
          const name = displayName(u)
          return (
            <Tr key={u.id}>
              <Td>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{initials(name)}</span>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-zinc-900">{u.first_name || u.last_name ? name : u.email}</div>
                    {(u.first_name || u.last_name) && <div className="truncate text-xs text-zinc-500">{u.email}</div>}
                  </div>
                </div>
              </Td>
              <Td>
                {u.is_superuser ? <Badge tone="brand">Owner</Badge> : u.is_staff ? <Badge>Staff</Badge> : <span className="text-zinc-400">Member</span>}
              </Td>
              <Td><Badge tone={u.is_active ? 'success' : 'danger'} dot>{u.is_active ? 'Active' : 'Inactive'}</Badge></Td>
              <Td>
                {u.group_names?.length
                  ? <div className="flex flex-wrap gap-1">{u.group_names.map(g => <Badge key={g}>{g}</Badge>)}</div>
                  : <span className="text-zinc-400">—</span>}
              </Td>
              <Td className="text-right">
                <ActionMenu actions={[
                  { label: 'Edit', icon: Pencil, onClick: () => openEdit(u) },
                  { label: 'Change password', icon: KeyRound, onClick: () => openPassword(u) },
                  { label: 'Assign groups', icon: Tags, onClick: () => openGroups(u) },
                  { label: 'Assign permissions', icon: ShieldCheck, onClick: () => openPermissions(u) },
                  { label: 'Delete', icon: Trash2, onClick: () => openDelete(u), variant: 'danger' },
                ]} />
              </Td>
            </Tr>
          )
        })}
      </Table>
      <Pagination page={page} pageSize={PAGE_SIZE} count={count} onChange={setPage} />

      <Modal isOpen={modal === 'create'} onClose={closeModal} title="Add user" footer={footer(handleCreate, 'Add user')}>
        <ErrorAlert message={error} />
        <UserForm data={formData} onChange={setFormData} isCreate errors={fieldErrors} />
      </Modal>

      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit user" footer={footer(handleEdit, 'Save changes')}>
        <ErrorAlert message={error} />
        <UserForm data={formData} onChange={setFormData} isCreate={false} errors={fieldErrors} />
      </Modal>

      <ConfirmDialog isOpen={modal === 'delete'} onClose={closeModal} onConfirm={handleDelete} loading={saving}
        title="Delete user" message={`Are you sure you want to delete "${selected?.email}"? This cannot be undone.`} />

      <Modal isOpen={modal === 'password'} onClose={closeModal} title="Change password" description={selected?.email} size="sm" footer={footer(handlePassword, 'Update password')}>
        <ErrorAlert message={error} />
        <ChangePasswordForm data={pwData} onChange={setPwData} errors={fieldErrors} />
      </Modal>

      <Modal isOpen={modal === 'groups'} onClose={closeModal} title="Assign groups" description={selected?.email} footer={footer(handleAssignGroups, 'Save')}>
        <ErrorAlert message={error} />
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {allGroups.map(g => (
            <Checkbox key={g.id} label={g.name} className="rounded-lg p-2 hover:bg-zinc-50"
              checked={selectedGroupIds.includes(g.id)}
              onChange={e => setSelectedGroupIds(ids => e.target.checked ? [...ids, g.id] : ids.filter(i => i !== g.id))} />
          ))}
          {allGroups.length === 0 && <p className="py-4 text-center text-sm text-zinc-400">No groups yet — create them on the Groups page.</p>}
        </div>
      </Modal>

      <Modal isOpen={modal === 'permissions'} onClose={closeModal} title="Assign permissions" description={selected?.email} size="xl">
        <ErrorAlert message={error} />
        <AssignPermissionsForm
          allPermissions={allPermissions}
          currentIds={selected?.user_permissions ?? []}
          onSave={handleAssignPermissions}
          onCancel={closeModal}
          loading={saving}
        />
      </Modal>
    </div>
  )
}
