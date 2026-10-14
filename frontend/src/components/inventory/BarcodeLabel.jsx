import { useEffect, useRef } from 'react'
import { drawCode128 } from '../../utils/barcode'

// Compact inline Code128 preview for tables and detail pages. The printable label is ThermalLabel.
export default function BarcodeLabel({ code }) {
  const bcRef = useRef(null)

  useEffect(() => {
    if (code && bcRef.current) drawCode128(bcRef.current, code, { width: 1.1, height: 30 })
  }, [code])

  return <canvas ref={bcRef} className="block" />
}
