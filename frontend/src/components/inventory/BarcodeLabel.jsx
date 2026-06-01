import { useEffect, useRef } from 'react'
import { drawCode128, drawQR } from '../../utils/barcode'

// `full` renders the printable label (name + price + Code128 + QR);
// otherwise it's a compact inline preview (Code128 only).
export default function BarcodeLabel({ code, product_name, price, full = false }) {
  const bcRef = useRef(null)
  const qrRef = useRef(null)

  useEffect(() => {
    if (!code) return
    if (bcRef.current) drawCode128(bcRef.current, code, full ? { width: 1.8, height: 56 } : { width: 1.1, height: 30 })
    if (full && qrRef.current) drawQR(qrRef.current, code, 110)
  }, [code, full])

  if (!full) {
    return <canvas ref={bcRef} className="block" />
  }

  return (
    <div className="barcode-label inline-flex flex-col items-center border border-gray-300 rounded-lg p-3 bg-white">
      {product_name && <div className="text-sm font-semibold text-gray-800 text-center max-w-[220px] truncate">{product_name}</div>}
      {price != null && price !== '' && <div className="text-xs text-gray-500">₹{price}</div>}
      <div className="flex items-center gap-3 mt-2">
        <canvas ref={bcRef} />
        <canvas ref={qrRef} />
      </div>
    </div>
  )
}
