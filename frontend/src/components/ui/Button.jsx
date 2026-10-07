import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

const variants = {
  primary: 'bg-brand-600 text-white shadow-card hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-white text-zinc-700 border border-zinc-300 shadow-card hover:bg-zinc-50 hover:text-zinc-900',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
  danger: 'bg-red-600 text-white shadow-card hover:bg-red-700',
  'danger-ghost': 'text-red-600 hover:bg-red-50',
}

const sizes = {
  xs: 'h-7 px-2 text-xs gap-1',
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  icon: 'h-8 w-8 justify-center',
}

// `as` lets a Link (or anything) wear button styles: <Button as={Link} to="/pos">.
export default function Button({
  as: Comp = 'button', variant = 'secondary', size = 'md', icon: Icon, loading = false,
  className, children, disabled, type, ...props
}) {
  const iconSize = size === 'lg' ? 18 : size === 'xs' ? 14 : 16
  return (
    <Comp
      type={Comp === 'button' ? (type ?? 'button') : undefined}
      disabled={Comp === 'button' ? disabled || loading : undefined}
      className={clsx(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant], sizes[size], className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={iconSize} className="animate-spin" /> : Icon && <Icon size={iconSize} strokeWidth={2} />}
      {children}
    </Comp>
  )
}
