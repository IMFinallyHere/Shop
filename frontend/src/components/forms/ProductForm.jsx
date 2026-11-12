import { Shuffle } from 'lucide-react'
import { Checkbox, Field, Input, Select } from '../ui/Field'

// onSuggestName (optional): shows a button that fills a suggested clothing name.
// hideName: the shop doesn't name products (the server does). requireCategory/requireSeller
// come from Settings. showActive: edit mode only, to deactivate/reactivate a product.
export default function ProductForm({
  data, onChange, categories, sellers, errors = {}, onSuggestName,
  hideName = false, requireCategory = false, requireSeller = false, showActive = false, compact = false,
}) {
  const set = (k) => (e) => onChange({ ...data, [k]: e.target.value })

  const field = (name, label, { required = false, placeholder, autoFocus } = {}) => (
    <Field label={label} required={required} error={errors[name]}>
      {id => <Input id={id} value={data[name] ?? ''} onChange={set(name)} required={required} invalid={!!errors[name]} placeholder={placeholder} autoFocus={autoFocus} />}
    </Field>
  )

  const select = (name, label, options, required = false) => (
    <Field label={label} required={required} error={errors[name]}>
      {id => (
        <Select id={id} value={data[name] ?? ''} onChange={set(name)} invalid={!!errors[name]}>
          <option value="">{required ? '— Select —' : '— None —'}</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      )}
    </Field>
  )

  return (
    <div className="space-y-4">
      {!hideName && (
        <div>
          {field('name', 'Product name', { required: true, placeholder: 'e.g. Cotton kurti', autoFocus: true })}
          {onSuggestName && (
            <button type="button" onClick={onSuggestName}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              <Shuffle size={12} /> Suggest another name
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {select('category', 'Category', categories, requireCategory)}
        {select('seller', 'Seller', sellers, requireSeller)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {field('fabric_type', 'Fabric', { placeholder: 'e.g. Cotton' })}
        {field('sku', 'SKU', { placeholder: 'Optional' })}
      </div>
      <Checkbox label={<span className="font-medium text-zinc-900">One-time stock</span>}
        description="Moves to Inactive once its stock sells out. Adding stock again brings it back."
        checked={!!data.is_one_time} onChange={e => onChange({ ...data, is_one_time: e.target.checked })} />
      {showActive && (
        <Checkbox label={<span className="font-medium text-zinc-900">Active</span>}
          description="Inactive products are hidden from the main list (use the Inactive filter to find them)."
          checked={data.is_active !== false} onChange={e => onChange({ ...data, is_active: e.target.checked })} />
      )}
      {!compact && <p className="text-xs text-zinc-500">Colors, sizes, cost and price are set per batch when you add stock.</p>}
    </div>
  )
}
