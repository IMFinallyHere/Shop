import { Plus, X } from 'lucide-react'
import { Field, Input, Textarea } from '../ui/Field'
import { MAX_PHONES } from '../../utils/inventoryForms'

// Fields for a seller (Sellers page and the quick-add from the product form).
export default function SellerForm({ form, onChange, errors = {} }) {
  const set = (k) => (e) => onChange({ ...form, [k]: e.target.value })
  const setPhone = (i, v) => onChange({ ...form, phones: form.phones.map((n, j) => (j === i ? v : n)) })
  const removePhone = (i) => onChange({ ...form, phones: form.phones.length > 1 ? form.phones.filter((_, j) => j !== i) : [''] })

  return (
    <div className="space-y-4">
      <Field label="Name" required error={errors.name}>
        {id => <Input id={id} autoFocus value={form.name} onChange={set('name')} invalid={!!errors.name} />}
      </Field>
      <div>
        <div className="mb-1.5 text-sm font-medium text-zinc-700">Phone numbers</div>
        <div className="space-y-2">
          {form.phones.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input type="tel" value={n} onChange={e => setPhone(i, e.target.value)} maxLength={20}
                placeholder={i === 0 ? 'Primary number' : 'Another number'} aria-label={`Phone number ${i + 1}`} invalid={!!errors.phones} />
              <button type="button" onClick={() => removePhone(i)} aria-label={`Remove phone number ${i + 1}`}
                className="rounded-md p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"><X size={15} /></button>
            </div>
          ))}
        </div>
        {errors.phones && <p className="mt-1.5 text-xs text-red-600">{errors.phones}</p>}
        {form.phones.length < MAX_PHONES && (
          <button type="button" onClick={() => onChange({ ...form, phones: [...form.phones, ''] })}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            <Plus size={15} /> Add another number
          </button>
        )}
      </div>
      <Field label="Email" error={errors.email}>{id => <Input id={id} type="email" value={form.email} onChange={set('email')} invalid={!!errors.email} />}</Field>
      <Field label="Address" error={errors.address}>{id => <Input id={id} value={form.address} onChange={set('address')} invalid={!!errors.address} />}</Field>
      <Field label="Notes" error={errors.notes}>{id => <Textarea id={id} rows={2} value={form.notes} onChange={set('notes')} />}</Field>
    </div>
  )
}
