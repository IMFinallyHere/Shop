import clsx from 'clsx'

export function Card({ className, children, ...props }) {
  return (
    <div className={clsx('rounded-xl border border-zinc-200 bg-white shadow-card', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={clsx('flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5', className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
