export default function UserForm({ data, onChange, isCreate, errors = {} }) {
  const field = (name, label, type = 'text', required = false, disabled = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={data[name] ?? ''}
        onChange={e => onChange({ ...data, [name]: e.target.value })}
        required={required}
        disabled={disabled}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-100 disabled:text-gray-500 ${errors[name] ? 'border-red-400' : 'border-gray-300'}`}
      />
      {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]}</p>}
    </div>
  )

  const checkbox = (name, label) => (
    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
      <input
        type="checkbox"
        checked={!!data[name]}
        onChange={e => onChange({ ...data, [name]: e.target.checked })}
        className="w-4 h-4 rounded text-indigo-600"
      />
      {label}
    </label>
  )

  return (
    <div className="space-y-4">
      {/* Email is the global identity; not editable once the account exists. */}
      {field('email', 'Email', 'email', true, !isCreate)}
      {isCreate && (
        <p className="-mt-2 text-xs text-gray-400">
          If this email already has an account, they'll simply be added to this shop
          (no password needed).
        </p>
      )}
      {field('first_name', 'First Name')}
      {field('last_name', 'Last Name')}
      {isCreate && field('password', 'Password', 'password')}
      <div className="flex gap-6 pt-1">
        {checkbox('is_staff', 'Staff (can manage this shop)')}
      </div>
    </div>
  )
}
