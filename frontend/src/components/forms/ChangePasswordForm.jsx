export default function ChangePasswordForm({ data, onChange }) {
  const field = (name, label) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="password"
        value={data[name] ?? ''}
        onChange={e => onChange({ ...data, [name]: e.target.value })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  )

  return (
    <div className="space-y-4">
      {field('old_password', 'Current Password')}
      {field('new_password', 'New Password')}
    </div>
  )
}
