import { Field, Input } from '../ui/Field'

// Fields for a category (Categories page and the quick-add from the product form).
export default function CategoryForm({ form, onChange, errors = {}, onSubmit }) {
  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); onSubmit?.() }}>
      <Field label="Name" required error={errors.name}>
        {id => <Input id={id} autoFocus value={form.name} onChange={e => onChange({ ...form, name: e.target.value })} invalid={!!errors.name} />}
      </Field>
      <Field label="Description" error={errors.description}>
        {id => <Input id={id} value={form.description} onChange={e => onChange({ ...form, description: e.target.value })} placeholder="Optional" invalid={!!errors.description} />}
      </Field>
      <button type="submit" hidden />
    </form>
  )
}
