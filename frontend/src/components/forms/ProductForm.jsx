export default function ProductForm({ data, onChange, categories, sellers, errors = {} }) {
  const set = (k) => (e) => onChange({ ...data, [k]: e.target.value })

  const field = (name, label, type = 'text', required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={data[name] ?? ''}
        onChange={set(name)}
        required={required}
        step={type === 'number' ? '0.01' : undefined}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors[name] ? 'border-red-400' : 'border-gray-300'}`}
      />
      {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]}</p>}
    </div>
  )

  const select = (name, label, options) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={data[name] ?? ''}
        onChange={set(name)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
      >
        <option value="">— none —</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  )

  return (
    <div className="space-y-4">
      {field('name', 'Product name', 'text', true)}
      <div className="grid grid-cols-2 gap-3">
        {select('category', 'Category', categories)}
        {select('seller', 'Seller', sellers)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field('fabric_type', 'Fabric')}
        {field('sku', 'SKU')}
      </div>
      <p className="text-xs text-gray-400">Colors, sizes, cost and price are set per batch when you add stock.</p>
    </div>
  )
}
