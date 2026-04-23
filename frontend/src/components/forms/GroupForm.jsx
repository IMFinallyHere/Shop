export default function GroupForm({ data, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Group Name <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={data.name ?? ''}
        onChange={e => onChange({ ...data, name: e.target.value })}
        required
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  )
}
