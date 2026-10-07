import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const cls = 'mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800'

// Goes back to wherever the user came from (search, a bill, another page). When the page
// was opened directly (no in-app history yet), links to `fallback` instead.
export default function BackLink({ fallback, label }) {
  const location = useLocation()
  const navigate = useNavigate()
  if (location.key === 'default') {
    return <Link to={fallback} className={cls}><ArrowLeft size={14} /> {label}</Link>
  }
  return <button type="button" onClick={() => navigate(-1)} className={cls}><ArrowLeft size={14} /> Back</button>
}
