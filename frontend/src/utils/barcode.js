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

// Compose one printable PNG label (name, price, Code128, QR) and download it.
export async function downloadLabel({ code, product_name, price }) {
  const bc = document.createElement('canvas')
  drawCode128(bc, code, { width: 1.8, height: 60 })
  const qr = document.createElement('canvas')
  await drawQR(qr, code, 150)

  const W = 380, H = 210, pad = 14
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 17px sans-serif'
  ctx.fillText((product_name ?? '').slice(0, 26), pad, pad + 14)
  if (price != null && price !== '') {
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#374151'
    ctx.fillText(`Rs. ${price}`, pad, pad + 36)
  }
  ctx.drawImage(bc, pad, 64, 210, bc.height)
  ctx.drawImage(qr, W - 150 - pad, 48, 150, 150)

  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `barcode-${code}.png`
  a.click()
}
