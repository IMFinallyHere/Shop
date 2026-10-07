import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronDown, KeyRound, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { changePassword } from '../../api/users'
import Modal from '../common/Modal'
import ErrorAlert from '../common/ErrorAlert'
import ChangePasswordForm from '../forms/ChangePasswordForm'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { useToast } from '../ui/Toast'
import { displayName, initials as toInitials } from '../../utils/format'

export default function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState({})
  const [pwErrors, setPwErrors] = useState({})
  const [pwError, setPwError] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey) }
  }, [open])

  const name = displayName(user)
  const initials = toInitials(name)
  const role = user?.is_superuser ? 'Superuser' : user?.is_staff ? 'Staff' : null

  const handleLogout = async () => { await logout(); navigate('/login') }

  const openPassword = () => { setOpen(false); setPw({}); setPwErrors({}); setPwError(''); setPwOpen(true) }
  const savePassword = async () => {
    setSaving(true); setPwErrors({}); setPwError('')
    try {
      await changePassword(user.id, pw)
      setPwOpen(false); toast('Password changed')
    } catch (e) {
      const d = e.response?.data || {}
      setPwErrors(Object.fromEntries(Object.entries(d).filter(([k]) => k in { old_password: 1, new_password: 1 }).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])))
      setPwError(d.detail || d.non_field_errors?.[0] || '')
    } finally { setSaving(false) }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} className={clsx('flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-zinc-100', open && 'bg-zinc-100')}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{initials || '?'}</span>
        <span className="hidden max-w-[160px] truncate text-sm font-medium text-zinc-700 sm:block">{name}</span>
        <ChevronDown size={14} className="text-zinc-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 w-60 animate-pop-in rounded-xl border border-zinc-200 bg-white p-1 shadow-pop">
          <div className="px-3 py-2.5">
            <div className="truncate text-sm font-medium text-zinc-900">{name}</div>
            <div className="truncate text-xs text-zinc-500">{user?.email}</div>
            {role && <Badge tone="brand" className="mt-2">{role}</Badge>}
          </div>
          <div className="my-1 border-t border-zinc-100" />
          <button onClick={openPassword} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
            <KeyRound size={15} className="text-zinc-400" /> Change password
          </button>
          <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
            <LogOut size={15} className="text-zinc-400" /> Log out
          </button>
        </div>
      )}

      <Modal isOpen={pwOpen} onClose={() => setPwOpen(false)} title="Change password" size="sm"
        footer={<>
          <Button onClick={() => setPwOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={savePassword} loading={saving}>Update password</Button>
        </>}>
        <ErrorAlert message={pwError} />
        <ChangePasswordForm data={pw} onChange={setPw} errors={pwErrors} />
      </Modal>
    </div>
  )
}
