import Logo from '../ui/Logo'

// Centered card for sign-in / sign-up / shop picker screens.
export default function AuthLayout({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,theme(colors.brand.100/.6),transparent_60%)]" />
      <div className={`relative w-full ${wide ? 'max-w-md' : 'max-w-sm'}`}>
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={44} className="mb-4 drop-shadow-sm" />
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-zinc-500">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-card sm:p-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-zinc-500">{footer}</div>}
      </div>
    </div>
  )
}
