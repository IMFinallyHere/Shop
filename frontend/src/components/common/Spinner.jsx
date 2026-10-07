import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

export default function Spinner({ className = '' }) {
  return (
    <div className={clsx('flex items-center justify-center py-12', className)}>
      <Loader2 size={24} className="animate-spin text-zinc-400" />
    </div>
  )
}
