import JsBarcode from 'jsbarcode'

// Render a Code128 1D barcode into a <canvas>.
export function drawCode128(canvas, code, opts = {}) {
  JsBarcode(canvas, code, {
    format: 'CODE128', displayValue: true, fontSize: 12,
    width: opts.width ?? 1.6, height: opts.height ?? 44, margin: 4,
  })
}

// Render Code128 into an <svg> that scales to fill its box (crisp at any printer DPI).
// Horizontal stretch keeps bar ratios intact, so the code still scans.
export function drawCode128Svg(svg, code) {
  JsBarcode(svg, code, { format: 'CODE128', displayValue: false, width: 2, height: 100, margin: 0 })
  const w = svg.getAttribute('width'), h = svg.getAttribute('height')
  svg.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`)
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.removeAttribute('width'); svg.removeAttribute('height')
  svg.removeAttribute('style')
}

// Code128 drawn with a whole number of printer dots per bar, so every bar of the same width prints
// the same width (a stretched SVG gives 2- and 3-dot bars at random). 0.25 mm is the smallest bar
// that scans reliably, which is 2 dots at 203 dpi and 3 at 300 dpi; it shrinks to fit narrow labels.
// Returns { canvas, widthMm } where the canvas is 1 pixel per dot (show it with image-rendering: pixelated).
export function drawCode128Dots(code, dpi, maxWidthMm) {
  const probe = document.createElement('canvas')
  JsBarcode(probe, code, { format: 'CODE128', width: 1, height: 1, margin: 0, displayValue: false })
  const modules = probe.width
  const wanted = Math.max(1, Math.round(0.25 * dpi / 25.4))
  const fits = Math.floor((maxWidthMm * dpi / 25.4) / modules)
  const dotsPerBar = Math.max(1, Math.min(wanted, fits))
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, code, { format: 'CODE128', width: dotsPerBar, height: 1, margin: 0, displayValue: false })
  return { canvas, widthMm: canvas.width * 25.4 / dpi }
}

function triggerDownload(canvas, filename) {
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = filename
  a.click()
}

// Compose a white card with the product name/price as a header above `inner`.
function labelCard(inner, { product_name, price }) {
  const pad = 14
  const W = Math.max(inner.width + pad * 2, 240)
  const headerH = price != null && price !== '' ? 54 : 36
  const H = inner.height + headerH + pad
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#111827'; ctx.font = 'bold 15px sans-serif'
  ctx.fillText((product_name ?? '').slice(0, 28), pad, pad + 12)  // callers pass the code when names are hidden
  if (price != null && price !== '') {
    ctx.font = '13px sans-serif'; ctx.fillStyle = '#374151'
    ctx.fillText(`Rs. ${price}`, pad, pad + 32)
  }
  ctx.drawImage(inner, (W - inner.width) / 2, headerH)
  return c
}

// Download just the Code128 barcode (with name/price header) as a PNG.
export function downloadCode128({ code, product_name, price }) {
  const bc = document.createElement('canvas')
  drawCode128(bc, code, { width: 1.9, height: 70 })
  triggerDownload(labelCard(bc, { product_name, price }), `barcode-${code}.png`)
}
