import { Field, Input } from '../ui/Field'

export default function GroupForm({ data, onChange, errors = {} }) {
  return (
    <Field label="Group name" required error={errors.name}>
      {id => (
        <Input id={id} autoFocus value={data.name ?? ''} invalid={!!errors.name} required
          onChange={e => onChange({ ...data, name: e.target.value })} placeholder="e.g. Cashiers" />
      )}
    </Field>
  )
}
