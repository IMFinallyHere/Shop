import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './Field'

export default function PasswordInput(props) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className="pr-10" {...props} />
      <button type="button" onClick={() => setShow(s => !s)} tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700"
        aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
