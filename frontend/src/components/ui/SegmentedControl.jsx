import clsx from 'clsx'

// options: [{ value, label }]. `stretch` makes segments share the full width.
export default function SegmentedControl({ options, value, onChange, stretch = false, size = 'md', className }) {
  return (
    <div className={clsx('inline-flex rounded-lg bg-zinc-100 p-0.5', stretch && 'flex w-full', className)} role="radiogroup">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-md font-medium transition-all',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            stretch && 'flex-1',
            value === o.value ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500 hover:text-zinc-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
