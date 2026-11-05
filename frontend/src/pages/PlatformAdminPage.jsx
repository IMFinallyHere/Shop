import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogOut, Store, Trash2, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { deleteTenant, getAdminTenants, getTenantUsers } from '../api/shops'
import Spinner from '../components/common/Spinner'
import Modal from '../components/common/Modal'
import Logo from '../components/ui/Logo'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { Table, Td, Tr } from '../components/ui/Table'
import { formatDate } from '../utils/format'
import { Field, Input } from '../components/ui/Field'
import { useToast } from '../components/ui/Toast'

export default function PlatformAdminPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)   // { tenant, users }
  const [detailLoading, setDetailLoading] = useState(false)
  const [doomed, setDoomed] = useState(null)       // shop being deleted
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const toast = useToast()

  useEffect(() => {
    getAdminTenants()
      .then(r => setTenants(r.data))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false))
  }, [])

  if (user && !user.is_superuser) return <Navigate to="/shops" replace />

  const openDetail = (slug) => {
    setDetailLoading(true); setDetail({ tenant: '', users: [] })
    getTenantUsers(slug)
      .then(r => setDetail(r.data))
      .catch(() => setDetail({ tenant: slug, users: [] }))
      .finally(() => setDetailLoading(false))
  }

  const openDelete = (t) => { setDoomed(t); setConfirmText(''); setDeleteError('') }
  const confirmed = doomed && confirmText.trim().toLowerCase() === doomed.slug
  const handleDelete = async () => {
    setDeleting(true); setDeleteError('')
    try {
      await deleteTenant(doomed.slug, confirmText.trim())
      setTenants(ts => ts.filter(t => t.slug !== doomed.slug))
      toast(`${doomed.name} deleted`)
      setDoomed(null)
    } catch (e) {
      setDeleteError(e.response?.data?.confirm || e.response?.data?.detail || 'Failed to delete the shop.')
    } finally { setDeleting(false) }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo size={28} />
          <span className="font-semibold text-zinc-900">Platform admin</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={Store} onClick={() => navigate('/shops')}>My shops</Button>
            <Button variant="ghost" size="sm" icon={LogOut} onClick={logout}>Sign out</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <PageHeader title="All shops" subtitle={`${tenants.length} shop${tenants.length !== 1 ? 's' : ''} on this platform · signed in as ${user?.email}`} />
        <Table
          columns={[{ label: 'Shop' }, { label: 'Owner' }, { label: 'Members' }, { label: 'Created' }, { label: '', className: 'w-px' }]}
          loading={loading} isEmpty={tenants.length === 0}
          empty={{ icon: Store, title: 'No shops yet' }}
        >
          {tenants.map(t => (
            <Tr key={t.id}>
              <Td>
                <div className="font-medium text-zinc-900">{t.name}</div>
                <div className="text-xs text-zinc-500">{t.domain}</div>
              </Td>
              <Td>{t.owner_email}</Td>
              <Td><Badge>{t.member_count}</Badge></Td>
              <Td className="text-zinc-500">{formatDate(t.created)}</Td>
              <Td>
                <div className="flex gap-1">
                  <Button variant="ghost" size="xs" icon={Users} onClick={() => openDetail(t.slug)}>Members</Button>
                  <Button variant="danger-ghost" size="xs" icon={Trash2} onClick={() => openDelete(t)} aria-label={`Delete ${t.name}`}>Delete</Button>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      </div>

      <Modal
        isOpen={!!doomed} onClose={() => !deleting && setDoomed(null)} title={`Delete ${doomed?.name ?? ''}?`}
        description={doomed?.domain}
        footer={<>
          <Button onClick={() => setDoomed(null)} disabled={deleting}>Cancel</Button>
          <Button variant="danger" icon={Trash2} onClick={handleDelete} loading={deleting} disabled={!confirmed}>Delete shop permanently</Button>
        </>}
      >
        <div className="space-y-3 text-sm text-zinc-700">
          <p className="rounded-lg bg-red-50 p-3 text-red-800 ring-1 ring-red-200">
            This permanently deletes the shop and <b>everything in it</b>: products, stock, bills, returns, store credit,
            settings and staff access ({doomed?.member_count ?? 0} member{doomed?.member_count === 1 ? '' : 's'}).
            It cannot be undone from here.
          </p>
          <p>Member accounts are kept, since they may belong to other shops. They just lose access to this one.</p>
          <Field label={<>Type <b className="font-mono">{doomed?.slug}</b> to confirm</>} error={deleteError}>
            {id => <Input id={id} value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && confirmed) handleDelete() }} />}
          </Field>
        </div>
      </Modal>

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="Members" description={detail?.tenant}>
        {detailLoading ? <Spinner /> : (
          <div className="divide-y divide-zinc-100">
            {(detail?.users ?? []).length === 0 && <p className="py-4 text-center text-sm text-zinc-400">No members.</p>}
            {(detail?.users ?? []).map(u => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-900">{u.email}</div>
                  <div className="text-xs text-zinc-500">{u.group_names?.join(', ') || 'No groups'}</div>
                </div>
                <div className="flex gap-1">
                  {u.is_superuser && <Badge tone="brand">Owner</Badge>}
                  {u.is_staff && <Badge>Staff</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
