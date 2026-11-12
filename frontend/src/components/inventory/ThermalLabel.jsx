import { useEffect, useMemo, useRef } from 'react'
import { drawCode128Dots, drawCode128Svg } from '../../utils/barcode'
import { labelDpi } from '../../utils/directPrint'
import { labelPrice } from '../../utils/format'
import { variantLabel } from '../../utils/variant'

// Open letterforms ("e" stays open at small sizes) and a bold weight survive a 203 dpi thermal head.
const FONT = "Verdana, 'DejaVu Sans', Arial, Helvetica, sans-serif"

// One stock-unit label at its true physical size (settings.label_width_mm × label_height_mm).
// Layout (sized for 50 × 25 mm, scaled for other sizes): name and colour/size on top, the price
// big, then a short barcode whose bars are a whole number of printer dots wide.
export default function ThermalLabel({ item, settings, className = '' }) {
  const barRef = useRef(null)
  const svgRef = useRef(null)
  const W = Number(settings.label_width_mm)
  const H = Number(settings.label_height_mm)
  const dpi = labelDpi()
  const s = Math.min(W / 50, H / 25)  // everything below is in mm for a 50 × 25 label
  const mm = (v) => `${(v * s).toFixed(2)}mm`

  const padX = Math.min(2.5, W * 0.05)
  const hideName = !!settings.hide_product_name
  const showName = settings.label_show_name && !hideName && item.product_name
  const variant = settings.label_show_variant && variantLabel(item)
  const price = settings.label_show_price ? labelPrice(item.price) : ''
  const showCode = settings.label_show_code_text || hideName

  // Barcode: fixed height, so there is room for the price; taller when no price is shown.
  const bar = useMemo(() => (item.code ? drawCode128Dots(item.code, dpi, W - 2 * padX) : null), [item.code, dpi, W, padX])
  const barHeight = price ? 5 : 8
  // Centre on a whole printer dot so no bar edge falls between dots.
  const dotMm = 25.4 / dpi
  const padDots = Math.round(padX / dotMm)
  const leftDots = bar ? Math.floor((Math.round(W / dotMm) - bar.canvas.width) / 2) : 0

  useEffect(() => {
    // (Re)paint the 1-pixel-per-dot canvas into the DOM canvas.
    const target = barRef.current
    if (!bar || !target) return
    target.width = bar.canvas.width; target.height = 1
    target.getContext('2d').drawImage(bar.canvas, 0, 0)
  })
  useEffect(() => { if (!bar && item.code && svgRef.current) drawCode128Svg(svgRef.current, item.code) }, [bar, item.code])

  return (
    <div
      className={`thermal-label flex flex-col overflow-hidden bg-white text-black ${className}`}
      style={{ width: `${W}mm`, height: `${H}mm`, padding: `${mm(1.2)} ${padX}mm`, fontFamily: FONT, lineHeight: 1.1 }}
    >
      {(showName || variant) && (
        <div className="flex items-baseline justify-between gap-[1.5mm]" style={{ fontSize: mm(2.75) }}>
          {showName && <span className="min-w-0 truncate font-bold">{item.product_name}</span>}
          {variant && <span className={`shrink-0 whitespace-nowrap font-semibold ${showName ? '' : 'mr-auto'}`}>{variant}</span>}
        </div>
      )}
      {price && <div className="font-bold" style={{ fontSize: mm(7.25), lineHeight: 1.05, marginTop: mm(0.4) }}>{price}</div>}
      <div className="min-h-0 flex-1" />
      {bar ? (
        <canvas ref={barRef} aria-label={`Barcode ${item.code}`}
          style={{ display: 'block', imageRendering: 'pixelated', width: `${bar.widthMm}mm`, height: mm(barHeight), marginLeft: `${(leftDots - padDots) * dotMm}mm` }} />
      ) : null}
      {!bar && <svg ref={svgRef} className="block w-full" style={{ height: mm(barHeight) }} />}
      {showCode && (
        <div className="text-center font-semibold tracking-wider" style={{ fontSize: mm(2.1), marginTop: mm(0.6) }}>{item.code}</div>
      )}
    </div>
  )
}
