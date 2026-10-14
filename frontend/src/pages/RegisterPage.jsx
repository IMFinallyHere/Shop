import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import useCreateShop from '../hooks/useCreateShop'
import AuthLayout from '../components/layout/AuthLayout'
import ErrorAlert from '../components/common/ErrorAlert'
import Button from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import PasswordInput from '../components/ui/PasswordInput'

export default function RegisterPage() {
  const [form, setForm] = useState({
    shop_name: '', email: '', password: '', first_name: '', last_name: '',
  })
  const { createShop, fieldErrors, error, loading, created: done } = useCreateShop()

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = (e) => {
    e.preventDefault()
    createShop(form)
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
            <Loader2 size={14} className="animate-spin" /> Opening your dashboard at {done.domain}…
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
