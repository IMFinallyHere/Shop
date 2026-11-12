// Direct printing through QZ Tray (a small desktop app on the billing laptop): jobs go
// straight to the printer chosen for each kind of print, with no browser dialog.
// The preview DOM is rasterised to PNG and sent as an image, so paper looks exactly
// like the on-screen preview. Printer names differ per laptop, so preferences live in
// this browser (localStorage), not in the shop's settings.

const PREFS_KEY = 'shop.directPrint'
const PX_PER_MM = 96 / 25.4
const DOTS_PER_PX = 203 / 96  // thermal heads are 203 dpi; render at twice that for crisp edges

// How a printer wants its pages, tuned once per laptop with a test print:
//   paper:       'exact' = send our page size; 'driver' = use the size set in the printer's own preferences
//   orientation: 'portrait' | 'landscape' | 'auto' (QZ decides; it rotates pages wider than tall)
//   rotation:    0 | 90 | 180 | 270 degrees, for drivers that feed sideways
//   fit:         'page' = scale to the page; 'actual' = true size (mm), no scaling
//   top / left:  margins in mm, to nudge a print that lands off the sticker or roll
//   dpi:         the printer's resolution (203 or 300), used by labels to print one image dot per printer dot
export const DEFAULT_PROFILE = { paper: 'exact', orientation: 'portrait', rotation: 0, fit: 'page', top: 0, left: 0, dpi: 203 }

export const DEFAULT_PREFS = {
  enabled: false, skipPreview: false, receiptPrinter: '', labelPrinter: '',
  profiles: { receipt: DEFAULT_PROFILE, label: DEFAULT_PROFILE },
}

export function getDirectPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    return {
      ...DEFAULT_PREFS, ...saved,
      profiles: {
        receipt: { ...DEFAULT_PROFILE, ...saved.profiles?.receipt },
        label: { ...DEFAULT_PROFILE, ...saved.profiles?.label },
      },
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function setDirectPrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* private window: not saved */ }
}

// Printer for this kind of job ('receipt' | 'label') when direct printing is on, else ''.
export function directPrinterFor(kind, prefs = getDirectPrefs()) {
  return prefs.enabled ? (prefs[`${kind}Printer`] || '') : ''
}

let qzPromise = null
const loadQz = () => {
  // Lazy: this module sits in the main bundle (PrintSheet), these don't need to.
  qzPromise ??= Promise.all([import('qz-tray'), import('../api/axiosInstance')]).then(([{ default: qz }, { default: api }]) => {
    // The site signs QZ's requests (see shopsettings QZSignView) so "Remember this
    // decision" sticks. If the server has no key configured, QZ still works but asks.
    let signed = null  // null = unknown, true/false once the cert was fetched
    qz.security.setCertificatePromise((resolve) => {
      api.get('/print/qz-cert/')
        .then(r => { signed = true; resolve(r.data.certificate) })
        .catch(() => { signed = false; resolve() })
    })
    qz.security.setSignatureAlgorithm('SHA512')
    qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
      if (signed === false) return resolve()
      api.post('/print/qz-sign/', { request: toSign })
        .then(r => resolve(r.data.signature))
        .catch(e => (e.response?.status === 404 ? resolve() : reject(e)))
    })
    return qz
  })
  return qzPromise
}

// Connects to QZ Tray if it isn't already; rejects when it isn't installed or running.
export async function connect() {
  const qz = await loadQz()
  if (!qz.websocket.isActive()) await qz.websocket.connect({ retries: 0 })
  return qz
}

export async function listPrinters() {
  const qz = await connect()
  const found = await qz.printers.find()
  return Array.isArray(found) ? found : [found]
}

let fontCss = null  // web fonts embedded once per page load, not per print

// The label printer's resolution on this laptop (dots per inch).
export const labelDpi = () => Number(getDirectPrefs().profiles.label.dpi) || DEFAULT_PROFILE.dpi

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error('Could not render the label'))
  img.src = src
})

// Crisp labels: render at 4x the printer's dots, average down to exactly one pixel per printer
// dot, then threshold to pure black/white ourselves. Sent 1:1, so neither QZ nor the driver
// resamples (resampling is what closed the "e" in "Green" and made bar widths uneven).
async function rasterizeLabel(node, { widthMm, heightMm, dpi, toPng, fontCss }) {
  const dotsW = Math.round(widthMm * dpi / 25.4)
  const dotsH = Math.round(heightMm * dpi / 25.4)
  const SUPER = 4
  node.classList.add('raster')
  let big
  try {
    big = await toPng(node, {
      pixelRatio: (dotsW * SUPER) / node.offsetWidth, backgroundColor: '#fff', fontEmbedCSS: fontCss, style: { margin: '0' },
    })
  } finally {
    node.classList.remove('raster')
  }
  const img = await loadImage(big)
  const canvas = document.createElement('canvas')
  canvas.width = dotsW; canvas.height = dotsH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dotsW, dotsH)
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, dotsW, dotsH)
  const px = ctx.getImageData(0, 0, dotsW, dotsH)
  for (let i = 0; i < px.data.length; i += 4) {
    const v = px.data[i] < 140 ? 0 : 255  // darker than ~45% grey prints black
    px.data[i] = px.data[i + 1] = px.data[i + 2] = v
  }
  ctx.putImageData(px, 0, 0)
  return canvas.toDataURL('image/png')
}

// Prints each node as one page of `size(node)` mm ({ width, height }) using this
// kind's profile (see DEFAULT_PROFILE).
export async function printNodes(printer, nodes, size, { jobName = 'Shop print', profile = DEFAULT_PROFILE, crisp = false } = {}) {
  const [qz, { toPng, getFontEmbedCSS }] = await Promise.all([connect(), import('html-to-image')])
  if (!nodes.length) throw new Error('Nothing to print')
  fontCss ??= await getFontEmbedCSS(nodes[0]).catch(() => '')

  const pixelRatio = DOTS_PER_PX * 2
  const pages = []
  const { width, height } = size(nodes[0])
  const p = { ...DEFAULT_PROFILE, ...profile }
  const dpi = Number(p.dpi) || DEFAULT_PROFILE.dpi
  for (const node of nodes) {
    if (crisp) {
      const png = await rasterizeLabel(node, { widthMm: width, heightMm: height, dpi, toPng, fontCss })
      pages.push(png.replace(/^data:image\/png;base64,/, ''))
      continue
    }
    node.classList.add('raster')  // thermal styles: solid black, no shadows/outlines
    try {
      // margin: 0 — the copy keeps the node's on-screen margins (the receipt is centred
      // with mx-auto/my-8), which would push it out of its own image and print blank paper.
      const png = await toPng(node, { pixelRatio, backgroundColor: '#fff', fontEmbedCSS: fontCss, style: { margin: '0' } })
      pages.push(png.replace(/^data:image\/png;base64,/, ''))
    } finally {
      node.classList.remove('raster')
    }
  }

  const options = {
    units: 'mm', colorType: 'blackwhite', jobName,
    margins: { top: Number(p.top) || 0, left: Number(p.left) || 0, right: 0, bottom: 0 },
    orientation: p.orientation === 'auto' ? null : p.orientation,
    rotation: Number(p.rotation) || 0,
    scaleContent: p.fit !== 'actual',
  }
  if (p.paper === 'exact') options.size = { width, height, custom: true }
  // True size: tell QZ how many image pixels make a millimetre.
  if (p.fit === 'actual') options.density = crisp ? dpi : Math.round(96 * pixelRatio / 25.4)
  const config = qz.configs.create(printer, options)
  await qz.print(config, pages.map(data => ({ type: 'pixel', format: 'image', flavor: 'base64', data })))
}

export const nodeHeightMm = (node) => Math.ceil(node.offsetHeight / PX_PER_MM)
