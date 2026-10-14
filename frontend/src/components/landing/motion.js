import { useEffect, useRef, useState } from 'react'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Marks an element `data-shown` once it scrolls into view (see .lp-reveal).
export function useReveal(threshold = 0.15) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) { el.dataset.shown = ''; return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.dataset.shown = ''; io.disconnect() }
    }, { threshold, rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return ref
}

// Counts smoothly from what's on screen to `value` (jumps straight there for reduced motion).
export function useCountUp(value, ms = 600) {
  const [shown, setShown] = useState(value)
  const latest = useRef(value)
  const reduced = prefersReducedMotion()
  useEffect(() => {
    if (reduced) return
    const start = performance.now(), from = latest.current
    let raf
    const tick = (t) => {
      const k = Math.min(1, (t - start) / ms)
      latest.current = Math.round(from + (value - from) * (1 - (1 - k) ** 3))
      setShown(latest.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms, reduced])
  return reduced ? value : shown
}
