import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCircle2, Loader2 } from 'lucide-react'
import useCreateShop from '../hooks/useCreateShop'
import useSubdomain from '../hooks/useSubdomain'
import { SITE_DOMAIN } from '../brand'
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
  const sub = useSubdomain(form.shop_name)
  const subError = sub.reason || (!sub.ready && fieldErrors.subdomain)

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (sub.ready) createShop({ ...form, subdomain: sub.value })
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
          <Field label="Shop address" required error={subError}
            hint={sub.status === 'checking' ? 'Checking…'
              : sub.ready ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check size={12} /> Available</span>
              : 'Your shop opens at this web address. You can change it.'}>
            {id => (
              <div className="flex">
                <Input id={id} value={sub.value} onChange={e => sub.setValue(e.target.value)} required invalid={!!subError}
                  placeholder="your-shop" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="rounded-r-none" />
                <span className="inline-flex shrink-0 items-center rounded-r-lg border border-l-0 border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-500">.{SITE_DOMAIN}</span>
              </div>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {field('first_name', 'First name', { autoComplete: 'given-name' })}
            {field('last_name', 'Last name', { autoComplete: 'family-name' })}
          </div>
          {field('email', 'Email', { type: 'email', required: true, autoComplete: 'email' })}
          {field('password', 'Password', { type: 'password', required: true, autoComplete: 'new-password' })}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading} disabled={!sub.ready}>
            {loading ? 'Creating…' : 'Create shop'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
