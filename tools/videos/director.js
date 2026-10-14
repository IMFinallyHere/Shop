// Drives the app like a person would, so viewers can follow: a visible cursor glides
// to each control, clicks show a ripple, and typing happens at a readable pace.

// Injected into every page before it loads.
const OVERLAY = `
(() => {
  const install = () => {
    if (document.getElementById('__howto_cursor')) return
    const style = document.createElement('style')
    style.textContent = \`
      #__howto_cursor { position: fixed; left: 0; top: 0; width: 26px; height: 26px; z-index: 2147483647;
        pointer-events: none; transform: translate(640px, 360px); transition: transform .6s cubic-bezier(.3,.7,.3,1); }
      .__howto_ripple { position: fixed; z-index: 2147483646; width: 34px; height: 34px; margin: -17px 0 0 -17px;
        border-radius: 50%; border: 3px solid #f59e0b; pointer-events: none; animation: __howto_ripple .6s ease-out forwards; }
      @keyframes __howto_ripple { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.6); opacity: 0 } }
      * { caret-color: #4f46e5; }\`
    document.head.appendChild(style)
    const c = document.createElement('div')
    c.id = '__howto_cursor'
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6 4.2 7.4-2.8 1.5-4.2-7.4L5 19z" fill="#111827" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    document.body.appendChild(c)
    const pos = window.__howtoPos || { x: 640, y: 360 }
    c.style.transition = 'none'
    c.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)'
  }
  window.__howtoMove = (x, y, ms) => {
    install()
    const c = document.getElementById('__howto_cursor')
    c.style.transition = 'transform ' + ms + 'ms cubic-bezier(.3,.7,.3,1)'
    c.style.transform = 'translate(' + (x - 3) + 'px,' + (y - 2) + 'px)'
    window.__howtoPos = { x: x - 3, y: y - 2 }
    try { sessionStorage.setItem('__howtoPos', JSON.stringify(window.__howtoPos)) } catch {}
  }
  window.__howtoRipple = (x, y) => {
    const r = document.createElement('div')
    r.className = '__howto_ripple'
    r.style.left = x + 'px'; r.style.top = y + 'px'
    document.body.appendChild(r)
    setTimeout(() => r.remove(), 700)
  }
  try { window.__howtoPos = JSON.parse(sessionStorage.getItem('__howtoPos')) || undefined } catch {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install)
  else install()
})()
`

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

class Director {
  constructor(page, base) {
    this.page = page
    this.base = base
  }

  static overlay() { return OVERLAY }

  // Already there (the recording starts on the scene's first page): don't reload.
  async goto(path) {
    const here = new URL(this.page.url() || 'about:blank', this.base)
    if (here.origin === new URL(this.base).origin && here.pathname + here.search === path) return
    await this.page.goto(this.base + path, { waitUntil: 'networkidle' })
    await this.page.evaluate(() => window.__howtoMove && window.__howtoMove(window.__howtoPos?.x ?? 640, window.__howtoPos?.y ?? 360, 0))
    await sleep(400)
  }

  async pause(ms) { await sleep(ms) }

  // Glide the cursor to the middle of `locator`.
  async point(locator, ms = 650) {
    await locator.scrollIntoViewIfNeeded()
    const box = await locator.boundingBox()
    if (!box) throw new Error('Element not visible: ' + locator)
    const x = box.x + box.width / 2, y = box.y + box.height / 2
    await this.page.evaluate(([x, y, ms]) => window.__howtoMove(x, y, ms), [x, y, ms])
    await sleep(ms + 120)
    return { x, y }
  }

  async click(locator, { after = 350 } = {}) {
    const { x, y } = await this.point(locator)
    await this.page.evaluate(([x, y]) => window.__howtoRipple(x, y), [x, y])
    await locator.click()
    await sleep(after)
  }

  // Click the field, then type at a readable pace.
  async type(locator, text, { clear = true, delay = 65 } = {}) {
    await this.click(locator, { after: 150 })
    if (clear) await locator.fill('')
    await locator.pressSequentially(String(text), { delay })
    await sleep(250)
  }

  async select(locator, label) {
    await this.click(locator, { after: 150 })
    await locator.selectOption({ label })
    await sleep(300)
  }

  async press(key) { await this.page.keyboard.press(key); await sleep(300) }
}

module.exports = { Director, sleep }
