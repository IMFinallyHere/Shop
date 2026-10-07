import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Search, X } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  const [local, setLocal] = useState(value)
  const timer = useRef(null)

  useEffect(() => { setLocal(value) }, [value])

  const handleChange = (e) => {
    setLocal(e.target.value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(e.target.value), 400)
  }

  const clear = () => { clearTimeout(timer.current); setLocal(''); onChange('') }

  return (
    <div className={clsx('relative w-full sm:w-72', className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
      <input type="text" value={local} onChange={handleChange} placeholder={placeholder} className="input pl-9 pr-8" />
      {local && (
        <button onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700" aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
