import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

// Render a Code128 1D barcode into a <canvas>.
export function drawCode128(canvas, code, opts = {}) {
  JsBarcode(canvas, code, {
    format: 'CODE128', displayValue: true, fontSize: 12,
    width: opts.width ?? 1.6, height: opts.height ?? 44, margin: 4,
  })
}

// Render a QR code into a <canvas> (async).
export function drawQR(canvas, code, size = 96) {
  return QRCode.toCanvas(canvas, code, { width: size, margin: 1 })
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
  ctx.fillText((product_name ?? '').slice(0, 28), pad, pad + 12)
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

// Download just the QR code (with name/price header) as a PNG.
export async function downloadQR({ code, product_name, price }) {
  const qr = document.createElement('canvas')
  await drawQR(qr, code, 220)
  triggerDownload(labelCard(qr, { product_name, price }), `qr-${code}.png`)
}
