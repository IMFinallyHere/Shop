// Records the in-app how-to videos from the real app, in English and Hindi.
//
//   node record.js                      all scenes, both languages
//   node record.js make-bill --lang hi  one scene, one language
//
// Needs: the dev servers (Django on :8000, Vite on :5173), macOS `say` with the Rishi and
// Lekha voices, ffmpeg, and Chrome. Writes frontend/public/videos/<scene>.<lang>.mp4|vtt,
// a poster per scene and index.json.
const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { chromium } = require('playwright-core')
const { Director, sleep } = require('./director')
const SCENES = require('./scenes')

const ROOT = path.resolve(__dirname, '../..')
const OUT = path.join(ROOT, 'frontend/public/videos')
const BASE = 'http://walkthrough.localhost:5173'
const OWNER = { email: 'video@demo.test', password: 'VideoDemo#2026' }
const VOICES = { en: 'Rishi', hi: 'Lekha' }  // macOS fallback when ElevenLabs isn't set up

// ElevenLabs: key in ~/.config/shop/elevenlabs.env (never in the repo), voices in voices.json.
// Every clip is cached by voice + model + text, so re-recording only pays for changed lines.
const EL_ENV = path.join(os.homedir(), '.config/shop/elevenlabs.env')
const EL_KEY = process.env.ELEVENLABS_API_KEY
  || (fs.existsSync(EL_ENV) && /ELEVENLABS_API_KEY=(\S+)/.exec(fs.readFileSync(EL_ENV, 'utf8'))?.[1])
const EL_CONFIG = fs.existsSync(path.join(__dirname, 'voices.json')) ? require('./voices.json') : null
const USE_EL = !!(EL_KEY && EL_CONFIG) && !process.argv.includes('--mac-voice')
const CACHE = path.join(__dirname, '.voice-cache')
const START = { 'add-product': '/products', 'print-tags': '/settings?tab=printing', 'make-bill': '/dashboard', returns: '/returns', 'setup-shop': '/settings', 'add-staff': '/users' }
const SIZE = { width: 1280, height: 720 }

const args = process.argv.slice(2)
const langArg = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null
const LANGS = langArg ? [langArg] : ['en', 'hi']
const names = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--lang')
const SCENE_IDS = names.length ? names : Object.keys(SCENES)

const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m)

// Spoken letters ("U P I") read better; captions show the word ("UPI").
const captionText = (s) => s.replace(/\b(?:[A-Z] )+[A-Z]\b/g, m => m.replace(/ /g, ''))

async function api(pathname, { token, method = 'GET', body } = {}) {
  const r = await fetch(`${BASE}/api${pathname}`, {
    method, body: body && JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!r.ok) throw new Error(`${method} ${pathname} → ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.status === 204 ? null : r.json()
}

// Fresh demo shop, signed in, with the tour already done (it would cover the screen).
async function prepareShop(scene) {
  execFileSync(path.join(ROOT, '.venv/bin/python'), ['manage.py', 'reset_video_shop'], { cwd: ROOT, stdio: 'ignore' })
  const tokens = await api('/auth/login/', { method: 'POST', body: OWNER })
  const token = tokens.access
  await api('/onboarding/', { token, method: 'PATCH', body: { tour_done: true, checklist_dismissed: true } })
  if (scene === 'setup-shop') {
    await api('/shop-settings/', { token, method: 'PUT', body: { default_tax_rate: '0', receipt_address: '', receipt_phone: '', receipt_gstin: '' } })
  }
  const stock = await api('/stock-items/?status=in_stock&page_size=100', { token })
  const codes = []
  for (const it of stock.results ?? stock) if (!codes.find(c => c.product === it.product_name)) codes.push({ product: it.product_name, code: it.code })
  const customers = await api('/customers/', { token })
  const bills = await api('/bills/', { token })
  let soldCode = null
  for (const b of bills.results ?? bills) {
    const full = await api(`/bills/${b.id}/`, { token })
    const item = full.customer_id && full.items.find(i => !i.returned)
    if (item) { soldCode = item.code; break }
  }
  return {
    tokens,
    data: {
      codes: codes.slice(0, 2).map(c => c.code),
      phone: (customers.results ?? customers)[0].phone,
      soldCode,
      staffEmail: 'neha@kavya.test',
    },
  }
}

const duration = (file) => Number(/estimated duration: ([\d.]+)/.exec(execFileSync('afinfo', [file]).toString())[1])

// Neighbouring lines go to ElevenLabs as context so each clip flows like one read.
async function elevenLabs(text, lang, { previous, next }) {
  const { model = 'eleven_multilingual_v2', settings = {} } = EL_CONFIG
  const voice = EL_CONFIG[lang]
  if (!voice) throw new Error(`voices.json has no voice for '${lang}'`)
  const key = crypto.createHash('sha1').update(JSON.stringify([voice, model, settings, text])).digest('hex')
  const file = path.join(CACHE, `${key}.mp3`)
  if (fs.existsSync(file)) return file
  fs.mkdirSync(CACHE, { recursive: true })
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text, model_id: model, previous_text: previous, next_text: next,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, ...settings },
    }),
  })
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`)
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()))
  return file
}

async function narrate(steps, i, lang, file) {
  if (USE_EL) {
    // Real voices read "UPI" and "GST" correctly; the spaced letters were for the Mac voice.
    const line = (j) => (steps[j] ? captionText(steps[j][lang]) : undefined)
    const clip = await elevenLabs(line(i), lang, { previous: line(i - 1), next: line(i + 1) })
    return { file: clip, seconds: duration(clip) }
  }
  execFileSync('say', ['-v', VOICES[lang], '-o', file, steps[i][lang]])
  return { file, seconds: duration(file) }
}

const vttTime = (s) => {
  const ms = Math.round(s * 1000)
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0')
  const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0')
  return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, '0')}`
}

async function record(sceneId, lang, work) {
  const scene = SCENES[sceneId]
  const { tokens, data } = await prepareShop(sceneId)
  const clips = []
  for (const i of scene.steps.keys()) clips.push(await narrate(scene.steps, i, lang, path.join(work, `${sceneId}.${lang}.${i}.aiff`)))

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, recordVideo: { dir: work, size: SIZE } })
  await ctx.addInitScript(([a, r]) => { localStorage.setItem('access_token', a); localStorage.setItem('refresh_token', r) }, [tokens.access, tokens.refresh])
  await ctx.addInitScript(Director.overlay())
  const page = await ctx.newPage()
  const pageStart = Date.now()
  const d = new Director(page, BASE)
  await d.goto(START[sceneId])
  await sleep(600)

  const t0 = Date.now()
  const cues = []
  for (const [i, step] of scene.steps.entries()) {
    const start = (Date.now() - t0) / 1000
    try {
      await step.do(d, data)
    } catch (e) {
      // Leave a picture of the screen for whoever fixes the scene.
      const shot = path.join(os.tmpdir(), `howto-failed-${sceneId}.${lang}.${i}.png`)
      await page.screenshot({ path: shot }).catch(() => {})
      e.message += `\n  step ${i + 1} of ${sceneId} (${lang}); screenshot: ${shot}`
      await browser.close().catch(() => {})
      throw e
    }
    const minEnd = start + clips[i].seconds + 0.6
    const now = (Date.now() - t0) / 1000
    if (now < minEnd) await sleep((minEnd - now) * 1000)
    cues.push({ start, end: (Date.now() - t0) / 1000, text: captionText(step[lang]) })
  }
  await sleep(1200)
  const total = (Date.now() - t0) / 1000
  const video = page.video()
  await ctx.close()
  await browser.close()
  const webm = await video.path()
  const trim = (t0 - pageStart) / 1000

  // Recording + each narration clip at its step's start → MP4 (H.264 + AAC).
  const mp4 = path.join(OUT, `${sceneId}.${lang}.mp4`)
  const inputs = ['-ss', trim.toFixed(3), '-i', webm]
  clips.forEach(c => inputs.push('-i', c.file))
  const delays = clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round(cues[i].start * 1000 + 150)}:all=1[a${i}]`)
  const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs,
    '-filter_complex', [...delays, mix].join(';'),
    '-map', '0:v', '-map', '[aout]', '-t', total.toFixed(2),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', '25',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', mp4])

  fs.writeFileSync(path.join(OUT, `${sceneId}.${lang}.vtt`),
    'WEBVTT\n\n' + cues.map(c => `${vttTime(c.start)} --> ${vttTime(c.end)}\n${c.text}\n`).join('\n'))

  const poster = `${sceneId}.jpg`
  if (lang === 'en' || !fs.existsSync(path.join(OUT, poster))) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', (total * 0.55).toFixed(2), '-i', mp4, '-frames:v', '1', '-q:v', '4', path.join(OUT, poster)])
  }
  return { seconds: Math.round(total), poster }
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  log(USE_EL ? `voices: ElevenLabs (${EL_CONFIG.model || 'eleven_multilingual_v2'})` : 'voices: macOS (Rishi, Lekha)')
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'howto-'))
  const indexFile = path.join(OUT, 'index.json')
  const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {}
  for (const id of SCENE_IDS) {
    if (!SCENES[id]) throw new Error(`No scene '${id}'. Scenes: ${Object.keys(SCENES).join(', ')}`)
    for (const lang of LANGS) {
      log(`recording ${id} (${lang})`)
      let result
      try {
        result = await record(id, lang, work)
      } catch (e) {
        // Timing hiccups happen in a live app; one fresh take (new demo shop) usually fixes it.
        log(`  retrying ${id} (${lang}) after: ${e.message.split('\n')[0]}`)
        result = await record(id, lang, work)
      }
      const { seconds, poster } = result
      index[id] = { ...(index[id] || {}), poster, [lang]: { seconds } }
      fs.writeFileSync(indexFile, JSON.stringify(index, null, 2))
      log(`  done: ${id}.${lang}.mp4, ${seconds}s`)
    }
  }
  fs.rmSync(work, { recursive: true, force: true })
})().catch(e => { console.error(e); process.exit(1) })
