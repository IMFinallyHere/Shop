import { useEffect, useState } from 'react'
import { getIncompleteProducts } from '../api/inventory'

// Number of products missing required details (drives the sidebar badge). Shared across components;
// call refreshMissingCount() after anything that can change it (saving a product, changing a rule).
let count = 0
const listeners = new Set()
const set = (n) => { count = n; listeners.forEach(l => l(n)) }

export function refreshMissingCount() {
  return getIncompleteProducts({ page: 1 }).then(r => set(r.data.count ?? 0)).catch(() => {})
}

export default function useMissingCount(enabled = true) {
  const [n, setN] = useState(count)
  useEffect(() => {
    if (!enabled) return undefined
    listeners.add(setN)
    refreshMissingCount()
    return () => { listeners.delete(setN) }
  }, [enabled])
  return n
}
