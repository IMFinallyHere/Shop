import clsx from 'clsx'

const tones = {
  neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
}

export default function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  )
}

// Small round color dot for a variant's color.
export function Swatch({ hex, className }) {
  if (!hex) return null
  return <span className={clsx('inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10', className)} style={{ backgroundColor: hex }} />
}
