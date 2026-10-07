import { useEffect, useRef } from 'react'
import { drawCode128 } from '../../utils/barcode'
import { variantLabel } from '../../utils/variant'

// `full` renders the printable label (name + color/size + price + Code128);
// otherwise it's a compact inline preview (Code128 only).
export default function BarcodeLabel({ code, product_name, color_name, size_name, price, full = false }) {
  const bcRef = useRef(null)

  useEffect(() => {
    if (!code) return
    if (bcRef.current) drawCode128(bcRef.current, code, full ? { width: 1.8, height: 56 } : { width: 1.1, height: 30 })
  }, [code, full])

  if (!full) {
    return <canvas ref={bcRef} className="block" />
  }

  return (
    <div className="barcode-label inline-flex flex-col items-center rounded-lg border border-zinc-200 bg-white p-3">
      {product_name && <div className="text-sm font-semibold text-gray-800 text-center max-w-[220px] truncate">{product_name}</div>}
      {variantLabel({ color_name, size_name }) && <div className="text-xs text-gray-600">{variantLabel({ color_name, size_name })}</div>}
      {price != null && price !== '' && <div className="text-xs text-gray-500">₹{price}</div>}
      <div className="flex items-center gap-3 mt-2">
        <canvas ref={bcRef} />
      </div>
    </div>
  )
}
