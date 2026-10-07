import clsx from 'clsx'

// Underline tabs. tabs: [{ value, label }]
export default function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={clsx('mb-6 flex gap-6 overflow-x-auto overflow-y-hidden border-b border-zinc-200', className)}>
      {tabs.map(t => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={clsx(
            '-mb-px whitespace-nowrap border-b-2 pb-2.5 text-sm font-medium transition-colors',
            value === t.value ? 'border-brand-600 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-800',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
