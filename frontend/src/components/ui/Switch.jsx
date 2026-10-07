import clsx from 'clsx'

export default function Switch({ checked, onChange, label, className }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} title={label}
      onClick={() => onChange(!checked)}
      className={clsx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-brand-600' : 'bg-zinc-300', className)}
    >
      <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  )
}
