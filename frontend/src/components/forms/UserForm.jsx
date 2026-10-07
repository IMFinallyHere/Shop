import { Checkbox, Field, Input } from '../ui/Field'

export default function UserForm({ data, onChange, isCreate, errors = {} }) {
  const field = (name, label, { type = 'text', required = false, disabled = false, hint } = {}) => (
    <Field label={label} required={required} error={errors[name]} hint={hint}>
      {id => (
        <Input id={id} type={type} value={data[name] ?? ''} required={required} disabled={disabled} invalid={!!errors[name]}
          onChange={e => onChange({ ...data, [name]: e.target.value })} />
      )}
    </Field>
  )

  return (
    <div className="space-y-4">
      {/* Email is the global identity; not editable once the account exists. */}
      {field('email', 'Email', {
        type: 'email', required: true, disabled: !isCreate,
        hint: isCreate ? "If this email already has an account, they'll simply be added to this shop (no password needed)." : undefined,
      })}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field('first_name', 'First name')}
        {field('last_name', 'Last name')}
      </div>
      {isCreate && field('password', 'Password', { type: 'password' })}
      <Checkbox
        checked={!!data.is_staff}
        onChange={e => onChange({ ...data, is_staff: e.target.checked })}
        label="Staff"
        description="Can manage this shop"
      />
    </div>
  )
}
