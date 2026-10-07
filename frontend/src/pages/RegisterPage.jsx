import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { signup } from '../api/auth'
import AuthLayout from '../components/layout/AuthLayout'
import ErrorAlert from '../components/common/ErrorAlert'
import Button from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import PasswordInput from '../components/ui/PasswordInput'

export default function RegisterPage() {
  const [form, setForm] = useState({
    shop_name: '', email: '', password: '', first_name: '', last_name: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setFieldErrors({}); setLoading(true)
    try {
      const { data } = await signup(form)
      setDone(data)
      // Redirect to the new shop's subdomain login after a short pause.
      const port = window.location.port ? `:${window.location.port}` : ''
      const url = `${window.location.protocol}//${data.domain}${port}/login`
      setTimeout(() => { window.location.assign(url) }, 1800)
    } catch (err) {
      const data = err.response?.data || {}
      const fields = {}
      let general = ''
      Object.entries(data).forEach(([key, val]) => {
        const msg = Array.isArray(val) ? val[0] : val
        if (['shop_name', 'email', 'password', 'first_name', 'last_name'].includes(key)) fields[key] = msg
        else general += (general ? ' ' : '') + msg
      })
      setFieldErrors(fields)
      setError(general || (Object.keys(fields).length === 0 ? 'Signup failed. Please try again.' : ''))
    } finally {
      setLoading(false)
    }
  }

  const field = (name, label, { type = 'text', required = false, ...rest } = {}) => (
    <Field label={label} required={required} error={fieldErrors[name]}>
      {id => type === 'password'
        ? <PasswordInput id={id} value={form[name]} onChange={update(name)} required={required} invalid={!!fieldErrors[name]} {...rest} />
        : <Input id={id} type={type} value={form[name]} onChange={update(name)} required={required} invalid={!!fieldErrors[name]} {...rest} />}
    </Field>
  )

  return (
    <AuthLayout title="Create your shop" subtitle="Set up your shop and owner account in a minute"
      footer={<>Already have a shop? <Link to="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link></>}>
      {done ? (
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle2 size={40} className="mb-3 text-emerald-500" />
          <p className="font-medium text-zinc-900">“{done.shop}” is ready</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
            <Loader2 size={14} className="animate-spin" /> Taking you to {done.domain}…
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <ErrorAlert message={error} />
          {field('shop_name', 'Shop name', { required: true, autoFocus: true, placeholder: 'e.g. Asha Boutique' })}
          <div className="grid grid-cols-2 gap-3">
            {field('first_name', 'First name', { autoComplete: 'given-name' })}
            {field('last_name', 'Last name', { autoComplete: 'family-name' })}
          </div>
          {field('email', 'Email', { type: 'email', required: true, autoComplete: 'email' })}
          {field('password', 'Password', { type: 'password', required: true, autoComplete: 'new-password' })}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
            {loading ? 'Creating…' : 'Create shop'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
