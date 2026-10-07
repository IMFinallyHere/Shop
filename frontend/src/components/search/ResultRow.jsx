import clsx from 'clsx'
import Badge from '../ui/Badge'
import { UNIT_STATUS } from './results'

export default function ResultRow({ item, icon: Icon, active, onSelect, onHover }) {
  const status = item.status && UNIT_STATUS[item.status]
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}  // keep input focus
      onClick={onSelect}
      onMouseEnter={onHover}
      className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors', active ? 'bg-brand-50' : 'hover:bg-zinc-50')}
    >
      <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', active ? 'bg-white text-brand-600' : 'bg-zinc-100 text-zinc-500')}>
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-900">{item.title}</span>
        {item.subtitle && <span className="block truncate text-xs text-zinc-500">{item.subtitle}</span>}
      </span>
      {status && <Badge tone={status.tone}>{status.label}</Badge>}
      {item.meta && <span className="shrink-0 text-sm tabular-nums text-zinc-700">{item.meta}</span>}
    </button>
  )
}
