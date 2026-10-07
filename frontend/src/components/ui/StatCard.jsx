import { Card } from './Card'

export default function StatCard({ label, value, hint, icon: Icon, loading }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">{label}</span>
        {Icon && <Icon size={16} className="text-zinc-400" />}
      </div>
      {loading
        ? <div className="mt-3 h-7 w-24 animate-pulse rounded bg-zinc-100" />
        : <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">{value}</div>}
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </Card>
  )
}
