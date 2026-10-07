import { Field, Input } from '../ui/Field'

export default function ChangePasswordForm({ data, onChange, errors = {} }) {
  const field = (name, label, autoComplete) => (
    <Field label={label} error={errors[name]}>
      {id => (
        <Input id={id} type="password" autoComplete={autoComplete} value={data[name] ?? ''} invalid={!!errors[name]}
          onChange={e => onChange({ ...data, [name]: e.target.value })} />
      )}
    </Field>
  )

  return (
    <div className="space-y-4">
      {field('old_password', 'Current password', 'current-password')}
      {field('new_password', 'New password', 'new-password')}
    </div>
  )
}
