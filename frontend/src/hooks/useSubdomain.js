import { useEffect, useState } from 'react'
import { checkSubdomain } from '../api/auth'

const MAX = 40

// Django's slugify, so the default matches the address the server would make.
const slugify = (s) => s.normalize('NFKD').replace(/[\u0080-￿]/g, '').toLowerCase()
  .replace(/[^\w\s-]/g, '').replace(/[-\s]+/g, '-').replace(/^[-_]+|[-_]+$/g, '')

export const suggestSubdomain = (shopName) =>
  slugify(shopName).replace(/_/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX).replace(/-+$/, '')

// What's typed into the address box: lowercase, spaces become hyphens, nothing else allowed.
const clean = (s) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, MAX)

const formatProblem = (s) =>
  s.length < 3 ? 'Use at least 3 characters.'
    : /^-|-$/.test(s) ? 'Start and end with a letter or number.'
    : null

// The shop's subdomain: follows the shop name until the owner edits it, and is checked
// against the server as they type. `ready` is true only once the server says it's free.
export default function useSubdomain(shopName) {
  const [custom, setCustom] = useState(null)
  const [result, setResult] = useState({ value: null, available: false, reason: '' })

  const value = custom ?? suggestSubdomain(shopName)
  const localProblem = value ? formatProblem(value) : null

  useEffect(() => {
    if (!value || localProblem) return
    let live = true
    const t = setTimeout(() => {
      checkSubdomain(value)
        .then(r => { if (live) setResult({ value, available: r.data.available, reason: r.data.reason }) })
        .catch(() => { if (live) setResult({ value, available: false, reason: 'Could not check this address. Try again.' }) })
    }, 350)
    return () => { live = false; clearTimeout(t) }
  }, [value, localProblem])

  const status = !value ? 'empty'
    : localProblem ? 'invalid'
    : result.value !== value ? 'checking'
    : result.available ? 'available' : 'invalid'

  return {
    value,
    setValue: (v) => setCustom(clean(v)),
    status,
    reason: localProblem || (status === 'invalid' ? result.reason : ''),
    ready: status === 'available',
  }
}
