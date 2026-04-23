import { useEffect, useState } from 'react'
import { getUsers, createUser, updateUser, deleteUser, changePassword, assignGroups, assignUserPermissions } from '../api/users'
import { getGroups } from '../api/groups'
import { getPermissions } from '../api/permissions'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import UserForm from '../components/forms/UserForm'
import ChangePasswordForm from '../components/forms/ChangePasswordForm'
import AssignPermissionsForm from '../components/forms/AssignPermissionsForm'
import SearchInput from '../components/common/SearchInput'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'

const EMPTY_USER = { username: '', email: '', first_name: '', last_name: '', password: '', is_staff: false, is_active: true }

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
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

  const PAGE_SIZE = 20

  useEffect(() => {
    getGroups().then(r => setAllGroups(r.data.results ?? r.data))
    getPermissions().then(r => setAllPermissions(r.data))
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [page, search])

  const fetchUsers = () => {
    setLoading(true)
    getUsers({ page, search })
      .then(r => {
        setUsers(r.data.results ?? r.data)
        setCount(r.data.count ?? (r.data.results ?? r.data).length)
      })
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false))
  }

  const openCreate = () => { setFormData({ ...EMPTY_USER }); setFieldErrors({}); setModal('create') }
  const openEdit = (u) => { setSelected(u); setFormData({ username: u.username, email: u.email, first_name: u.first_name, last_name: u.last_name, is_staff: u.is_staff, is_active: u.is_active }); setFieldErrors({}); setModal('edit') }
  const openDelete = (u) => { setSelected(u); setModal('delete') }
  const openPassword = (u) => { setSelected(u); setPwData({ old_password: '', new_password: '' }); setModal('password') }
  const openGroups = (u) => { setSelected(u); setSelectedGroupIds(u.groups); setModal('groups') }
  const openPermissions = (u) => { setSelected(u); setModal('permissions') }
  const closeModal = () => { setModal(null); setSelected(null); setError(''); setFieldErrors({}) }

  const parseFieldErrors = (responseData) => {
    const knownFields = ['username', 'email', 'first_name', 'last_name', 'password', 'is_staff', 'is_active']
    const fields = {}
    let general = ''
    Object.entries(responseData || {}).forEach(([key, val]) => {
      const msg = Array.isArray(val) ? val[0] : val
      if (knownFields.includes(key)) fields[key] = msg
      else general += (general ? ' ' : '') + msg
    })
    return { fields, general }
  }

  const handleCreate = async () => {
    setSaving(true); setError(''); setFieldErrors({})
    try { await createUser(formData); fetchUsers(); closeModal() }
    catch (e) {
      const { fields, general } = parseFieldErrors(e.response?.data)
      setFieldErrors(fields)
      setError(general || (Object.keys(fields).length === 0 ? 'Failed to create user.' : ''))
    }
    finally { setSaving(false) }
  }

  const handleEdit = async () => {
    setSaving(true); setError(''); setFieldErrors({})
    try { await updateUser(selected.id, formData); fetchUsers(); closeModal() }
    catch (e) {
      const { fields, general } = parseFieldErrors(e.response?.data)
      setFieldErrors(fields)
      setError(general || (Object.keys(fields).length === 0 ? 'Failed to update user.' : ''))
    }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true)
    try { await deleteUser(selected.id); fetchUsers(); closeModal() }
    catch (e) { setError(e.response?.data?.detail || 'Failed to delete user.') }
    finally { setSaving(false) }
  }

  const handlePassword = async () => {
    setSaving(true); setError('')
    try { await changePassword(selected.id, pwData); closeModal() }
    catch (e) { setError(e.response?.data?.old_password || e.response?.data?.detail || 'Failed to change password.') }
    finally { setSaving(false) }
  }

  const handleAssignGroups = async () => {
    setSaving(true)
    try { await assignGroups(selected.id, selectedGroupIds); fetchUsers(); closeModal() }
    catch { setError('Failed to assign groups.') }
    finally { setSaving(false) }
  }

  const handleAssignPermissions = async (ids) => {
    setSaving(true)
    try { await assignUserPermissions(selected.id, ids); fetchUsers(); closeModal() }
    catch { setError('Failed to assign permissions.') }
    finally { setSaving(false) }
  }

  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Users</h1>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New User
        </button>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Search users…" />
      </div>

      <ErrorAlert message={error} onDismiss={() => setError('')} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Username', 'Email', 'Name', 'Staff', 'Active', 'Groups', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {u.username}
                    {u.is_superuser && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">super</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_staff ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_staff ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.group_names?.join(', ') || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {[
                        { label: 'Edit', fn: () => openEdit(u), color: 'text-indigo-600 hover:text-indigo-800' },
                        { label: 'Pwd', fn: () => openPassword(u), color: 'text-gray-500 hover:text-gray-700' },
                        { label: 'Groups', fn: () => openGroups(u), color: 'text-emerald-600 hover:text-emerald-800' },
                        { label: 'Perms', fn: () => openPermissions(u), color: 'text-amber-600 hover:text-amber-800' },
                        { label: 'Delete', fn: () => openDelete(u), color: 'text-red-500 hover:text-red-700' },
                      ].map(({ label, fn, color }) => (
                        <button key={label} onClick={fn} className={`text-xs font-medium ${color}`}>{label}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded border text-sm disabled:opacity-40">Prev</button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded border text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={modal === 'create'} onClose={closeModal} title="Create User" size="md">
        <ErrorAlert message={error} />
        <UserForm data={formData} onChange={setFormData} isCreate errors={fieldErrors} />
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={modal === 'edit'} onClose={closeModal} title="Edit User" size="md">
        <ErrorAlert message={error} />
        <UserForm data={formData} onChange={setFormData} isCreate={false} errors={fieldErrors} />
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={handleEdit} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <ConfirmDialog
        isOpen={modal === 'delete'}
        onClose={closeModal}
        onConfirm={handleDelete}
        loading={saving}
        title="Delete User"
        message={`Are you sure you want to delete "${selected?.username}"? This cannot be undone.`}
      />

      {/* Change Password Modal */}
      <Modal isOpen={modal === 'password'} onClose={closeModal} title={`Change Password — ${selected?.username}`} size="sm">
        <ErrorAlert message={error} />
        <ChangePasswordForm data={pwData} onChange={setPwData} />
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={handlePassword} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{saving ? 'Saving…' : 'Update'}</button>
        </div>
      </Modal>

      {/* Assign Groups Modal */}
      <Modal isOpen={modal === 'groups'} onClose={closeModal} title={`Assign Groups — ${selected?.username}`} size="md">
        <ErrorAlert message={error} />
        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {allGroups.map(g => (
            <label key={g.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedGroupIds.includes(g.id)}
                onChange={e => setSelectedGroupIds(ids => e.target.checked ? [...ids, g.id] : ids.filter(i => i !== g.id))}
                className="w-4 h-4 text-indigo-600"
              />
              <span className="text-sm text-gray-700">{g.name}</span>
            </label>
          ))}
          {allGroups.length === 0 && <p className="text-sm text-gray-400">No groups available</p>}
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Cancel</button>
          <button onClick={handleAssignGroups} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>

      {/* Assign Permissions Modal */}
      <Modal isOpen={modal === 'permissions'} onClose={closeModal} title={`Assign Permissions — ${selected?.username}`} size="xl">
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
