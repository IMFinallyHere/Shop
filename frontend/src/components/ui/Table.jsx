import clsx from 'clsx'
import EmptyState from './EmptyState'

// Card-wrapped table. Pass `loading` to show skeleton rows and `empty` (EmptyState props)
// for when `rows` is empty. `columns`: [{ label, className }].
export function Table({ columns, loading, isEmpty, empty, children, className, skeletonRows = 6 }) {
  return (
    <div className={clsx('overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-card', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80">
              {columns.map((c, i) => (
                <th key={i} className={clsx('whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-zinc-500', c.className)}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading
              ? Array.from({ length: skeletonRows }).map((_, r) => (
                  <tr key={r}>
                    {columns.map((_, i) => (
                      <td key={i} className="px-4 py-3.5">
                        <div className="h-3.5 animate-pulse rounded bg-zinc-100" style={{ width: `${50 + ((r * 7 + i * 13) % 40)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : children}
          </tbody>
        </table>
      </div>
      {!loading && isEmpty && <EmptyState {...empty} />}
    </div>
  )
}

export function Tr({ className, children, ...props }) {
  return <tr className={clsx('transition-colors hover:bg-zinc-50/70', className)} {...props}>{children}</tr>
}

export function Td({ className, children, ...props }) {
  return <td className={clsx('px-4 py-3 align-middle text-zinc-700', className)} {...props}>{children}</td>
}
