import { useEffect, useRef } from 'react'
import { drawCode128Svg } from '../../utils/barcode'
import { variantLabel } from '../../utils/variant'

// One stock-unit label at its true physical size (settings.label_width_mm × label_height_mm).
// Text scales with the label height; the barcode fills whatever space is left.
export default function ThermalLabel({ item, settings, className = '' }) {
  const svgRef = useRef(null)
  const W = Number(settings.label_width_mm)
  const H = Number(settings.label_height_mm)

  useEffect(() => {
    if (item.code && svgRef.current) drawCode128Svg(svgRef.current, item.code)
  }, [item.code])

  const big = Math.min(11, Math.max(6, H * 0.3))  // pt
  const small = big - 1.5
  const variant = settings.label_show_variant && variantLabel(item)
  const price = settings.label_show_price && item.price != null && item.price !== '' ? `₹${item.price}` : ''

  return (
    <div
      className={`thermal-label flex flex-col overflow-hidden bg-white text-black ${className}`}
      style={{ width: `${W}mm`, height: `${H}mm`, padding: '1.5mm 2.5mm', fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: 1.15 }}
    >
      {settings.label_show_name && item.product_name && (
        <div className="truncate font-bold" style={{ fontSize: `${big}pt` }}>{item.product_name}</div>
      )}
      {(variant || price) && (
        <div className="flex justify-between gap-2" style={{ fontSize: `${small}pt` }}>
          <span className="truncate">{variant}</span>
          {price && <span className="shrink-0 font-bold">{price}</span>}
        </div>
      )}
      <div className="min-h-0 flex-1" style={{ marginTop: '0.8mm' }}>
        <svg ref={svgRef} className="block h-full w-full" />
      </div>
      {settings.label_show_code_text && (
        <div className="text-center tracking-wider" style={{ fontSize: `${small}pt`, fontFamily: 'ui-monospace, Menlo, monospace' }}>{item.code}</div>
      )}
    </div>
  )
}
