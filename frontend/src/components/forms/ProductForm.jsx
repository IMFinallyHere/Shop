import { Field, Input, Select } from '../ui/Field'

export default function ProductForm({ data, onChange, categories, sellers, errors = {} }) {
  const set = (k) => (e) => onChange({ ...data, [k]: e.target.value })

  const field = (name, label, { required = false, placeholder, autoFocus } = {}) => (
    <Field label={label} required={required} error={errors[name]}>
      {id => <Input id={id} value={data[name] ?? ''} onChange={set(name)} required={required} invalid={!!errors[name]} placeholder={placeholder} autoFocus={autoFocus} />}
    </Field>
  )

  const select = (name, label, options) => (
    <Field label={label} error={errors[name]}>
      {id => (
        <Select id={id} value={data[name] ?? ''} onChange={set(name)} invalid={!!errors[name]}>
          <option value="">— None —</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      )}
    </Field>
  )

  return (
    <div className="space-y-4">
      {field('name', 'Product name', { required: true, placeholder: 'e.g. Cotton kurti', autoFocus: true })}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {select('category', 'Category', categories)}
        {select('seller', 'Seller', sellers)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field('fabric_type', 'Fabric', { placeholder: 'e.g. Cotton' })}
        {field('sku', 'SKU', { placeholder: 'Optional' })}
      </div>
      <p className="text-xs text-zinc-500">Colors, sizes, cost and price are set per batch when you add stock.</p>
    </div>
  )
}
