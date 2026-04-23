export default function UserForm({ data, onChange, isCreate, errors = {} }) {
  const field = (name, label, type = 'text', required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={data[name] ?? ''}
        onChange={e => onChange({ ...data, [name]: e.target.value })}
        required={required}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors[name] ? 'border-red-400' : 'border-gray-300'}`}
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
      {field('username', 'Username', 'text', true)}
      {field('email', 'Email', 'email')}
      {field('first_name', 'First Name')}
      {field('last_name', 'Last Name')}
      {isCreate && field('password', 'Password', 'password', true)}
      <div className="flex gap-6 pt-1">
        {checkbox('is_staff', 'Staff')}
        {checkbox('is_active', 'Active')}
      </div>
    </div>
  )
}
