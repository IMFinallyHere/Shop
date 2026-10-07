import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { homePath } from '../utils/domain'
import AuthLayout from '../components/layout/AuthLayout'
import ErrorAlert from '../components/common/ErrorAlert'
import Button from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import PasswordInput from '../components/ui/PasswordInput'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate(homePath())
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your shop"
      footer={<>New here? <Link to="/register" className="font-medium text-brand-600 hover:underline">Create a shop</Link></>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorAlert message={error} />
        <Field label="Email">
          {id => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required autoFocus />}
        </Field>
        <Field label="Password">
          {id => <PasswordInput id={id} autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />}
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
