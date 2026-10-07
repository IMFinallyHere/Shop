import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from './Button'

export default function Pagination({ page, pageSize, count, onChange }) {
  const totalPages = Math.ceil(count / pageSize)
  if (totalPages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, count)
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
      <span>
        <span className="font-medium text-zinc-700">{from}–{to}</span> of <span className="font-medium text-zinc-700">{count}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" icon={ChevronLeft} onClick={() => onChange(page - 1)} disabled={page <= 1}>Prev</Button>
        <Button size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          Next <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  )
}
