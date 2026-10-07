import { useCallback, useEffect, useRef, useState } from 'react'

// Load data with `loader()` (an axios call) whenever `key` changes.
// - `loading` is true until the first response for the current key arrives;
//   `reload()` refetches in the background and keeps showing the current data.
// - `setData(fn)` patches the cached response locally.
export default function useQuery(loader, key = '') {
  const loaderRef = useRef(loader)
  useEffect(() => { loaderRef.current = loader })

  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState({ key: null, data: undefined, error: null })

  useEffect(() => {
    let live = true
    loaderRef.current()
      .then(r => { if (live) setState({ key, data: r.data, error: null }) })
      .catch(e => { if (live) setState(s => ({ key, data: s.key === key ? s.data : undefined, error: e })) })
    return () => { live = false }
  }, [key, nonce])

  const reload = useCallback(() => setNonce(n => n + 1), [])
  const setData = useCallback((fn) => setState(s => ({ ...s, data: fn(s.data) })), [])

  return { data: state.data, error: state.error, loading: state.key !== key, reload, setData }
}

// DRF paginated or plain list → { rows, count }.
export const asList = (data) => ({ rows: data?.results ?? data ?? [], count: data?.count ?? (data?.results ?? data ?? []).length })
