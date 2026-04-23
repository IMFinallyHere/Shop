import { useEffect, useRef, useState } from 'react'

export default function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  const [local, setLocal] = useState(value)
  const timer = useRef(null)

  useEffect(() => { setLocal(value) }, [value])

  const handleChange = (e) => {
    setLocal(e.target.value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(e.target.value), 400)
  }

  return (
    <input
      type="text"
      value={local}
      onChange={handleChange}
      placeholder={placeholder}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-400"
    />
  )
}
