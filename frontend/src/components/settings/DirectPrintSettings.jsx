import { useCallback, useEffect, useState } from 'react'
import { Download, Printer, RefreshCw, RotateCcw } from 'lucide-react'
import Section from './Section'
import Button from '../ui/Button'
import Switch from '../ui/Switch'
import { Field, Input, Select } from '../ui/Field'
import { DEFAULT_PROFILE, getDirectPrefs, listPrinters, setDirectPrefs } from '../../utils/directPrint'

// Per-laptop printer routing through QZ Tray. Saved in this browser right away
// (printer names differ between laptops), separate from the shop's print settings.
export default function DirectPrintSettings({ onTestReceipt, onTestLabel }) {
  const [prefs, setPrefs] = useState(getDirectPrefs)
  const [status, setStatus] = useState('checking')  // checking | connected | offline
  const [printers, setPrinters] = useState([])

  const check = useCallback(() => listPrinters()
    .then(list => { setPrinters(list); setStatus('connected') })
    .catch(() => setStatus('offline')), [])
  useEffect(() => { check() }, [check])
  const refresh = () => { setStatus('checking'); check() }

  const update = (patch) => setPrefs(p => { const next = { ...p, ...patch }; setDirectPrefs(next); return next })
  const setProfile = (kind, patch) => setPrefs(p => {
    const next = { ...p, profiles: { ...p.profiles, [kind]: { ...p.profiles[kind], ...patch } } }
    setDirectPrefs(next)
    return next
  })

  // QZ only remembers "Allow" for sites whose certificate it trusts; ours is self-signed,
  // so each laptop installs it once as QZ Tray's override.crt.
  const [certError, setCertError] = useState('')
  const downloadCert = async () => {
    setCertError('')
    try {
      const { default: api } = await import('../../api/axiosInstance')
      const { data } = await api.get('/print/qz-cert/')
      const url = URL.createObjectURL(new Blob([data.certificate], { type: 'application/x-x509-ca-cert' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: 'override.crt' })
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setCertError('Could not download the certificate.')
    }
  }

  // Keep a saved printer selectable even if it's switched off right now.
  const options = (current) => [...new Set([...(current ? [current] : []), ...printers])]

  return (
    <Section
      title="Direct printing (this laptop)"
      description="Send receipts and labels straight to the right printer, without the print dialog. Needs the free QZ Tray app running on this laptop. Saved on this laptop only."
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className={`inline-flex items-center gap-1.5 font-medium ${status === 'connected' ? 'text-emerald-700' : status === 'offline' ? 'text-red-600' : 'text-zinc-500'}`}>
          <span className={`h-2 w-2 rounded-full ${status === 'connected' ? 'bg-emerald-500' : status === 'offline' ? 'bg-red-500' : 'bg-zinc-300'}`} />
          {status === 'connected' ? 'QZ Tray connected' : status === 'offline' ? 'QZ Tray not running' : 'Looking for QZ Tray…'}
        </span>
        <Button size="xs" icon={RefreshCw} onClick={refresh} loading={status === 'checking'}>Retry</Button>
        {status === 'offline' && (
          <a href="https://qz.io/download/" target="_blank" rel="noreferrer" className="text-brand-700 underline underline-offset-2">Download QZ Tray</a>
        )}
      </div>

      <div className="divide-y divide-zinc-100">
        <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm text-zinc-700">
          Print directly, without the dialog
          <Switch checked={prefs.enabled} onChange={v => update({ enabled: v })} label="Print directly" />
        </label>
        <label className={`flex items-center justify-between gap-3 py-1.5 text-sm ${prefs.enabled ? 'cursor-pointer text-zinc-700' : 'text-zinc-400'}`}>
          <span>Skip the preview <span className="text-zinc-400">(label buttons and auto-print after checkout print instantly)</span></span>
          <Switch checked={prefs.skipPreview} onChange={v => update({ skipPreview: v })} label="Skip the preview" disabled={!prefs.enabled} />
        </label>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <PrinterCard
          title="Receipt printer" hint="Bills and credit notes (thermal roll)"
          printer={prefs.receiptPrinter} printers={options(prefs.receiptPrinter)} disabled={!prefs.enabled}
          onPrinter={v => update({ receiptPrinter: v })}
          profile={prefs.profiles.receipt} onProfile={v => setProfile('receipt', v)} onTest={onTestReceipt}
        />
        <PrinterCard
          title="Label printer" hint="Barcode stickers"
          printer={prefs.labelPrinter} printers={options(prefs.labelPrinter)} disabled={!prefs.enabled}
          onPrinter={v => update({ labelPrinter: v })}
          profile={prefs.profiles.label} onProfile={v => setProfile('label', v)} onTest={onTestLabel} showDpi
        />
      </div>

      <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <b>QZ Tray says "Untrusted website" and won't remember Allow?</b>
          <Button size="xs" icon={Download} onClick={downloadCert}>Download certificate</Button>
        </div>
        {certError && <div className="mb-1 text-red-600">{certError}</div>}
        <ol className="list-decimal space-y-0.5 pl-5">
          <li>Click <b>Download certificate</b>. You get a file called <b>override.crt</b>.</li>
          <li>Copy it into QZ Tray's folder (needs admin). Windows: <code>C:\Program Files\QZ Tray\</code>. Mac: right-click QZ Tray in Applications → Show Package Contents → <code>Contents/Resources/</code>.</li>
          <li>Quit QZ Tray (tray icon → Exit) and start it again.</li>
          <li>Print a test. The prompt now shows the site as trusted: tick <b>Remember this decision</b> and click <b>Allow</b>. One time per laptop.</li>
        </ol>
      </div>

      <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-zinc-500">
        <li>Install QZ Tray from qz.io/download and leave it running (it starts with the laptop).</li>
        <li>Come back here, click Retry, switch on direct printing and pick the two printers.</li>
        <li>Click <b>Test</b> under each printer. Allow the "local network" prompt from Chrome, and in QZ Tray's prompt tick <b>Remember this decision</b> and click <b>Allow</b>. Both are one-time.</li>
        <li>Print turned sideways or shrunk? Change <b>Orientation</b> (or Rotate) and test again. Off the sticker or roll? Add a top/left margin. Everything here saves instantly on this laptop.</li>
      </ol>
    </Section>
  )
}

const ORIENTATIONS = [['portrait', 'Portrait'], ['landscape', 'Landscape'], ['auto', 'Auto']]
const ROTATIONS = [0, 90, 180, 270]

// One printer + its profile (how it wants pages), saved on this laptop.
function PrinterCard({ title, hint, printer, printers, disabled, onPrinter, profile, onProfile, onTest, showDpi = false }) {
  const num = (k) => (e) => onProfile({ [k]: e.target.value === '' ? 0 : Math.max(0, Math.min(30, Number(e.target.value))) })
  const off = disabled || !printer
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <Field label={title} hint={hint}>
        {id => (
          <Select id={id} value={printer} onChange={e => onPrinter(e.target.value)} disabled={disabled}>
            <option value="">Use the print dialog</option>
            {printers.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
        )}
      </Field>
      <fieldset disabled={off} className={`mt-3 grid grid-cols-2 gap-2 ${off ? 'opacity-50' : ''}`}>
        <Field label="Orientation">
          {id => (
            <Select id={id} value={profile.orientation} onChange={e => onProfile({ orientation: e.target.value })}>
              {ORIENTATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Rotate">
          {id => (
            <Select id={id} value={profile.rotation} onChange={e => onProfile({ rotation: Number(e.target.value) })}>
              {ROTATIONS.map(r => <option key={r} value={r}>{r}°</option>)}
            </Select>
          )}
        </Field>
        <Field label="Paper size">
          {id => (
            <Select id={id} value={profile.paper} onChange={e => onProfile({ paper: e.target.value })}>
              <option value="exact">From this app</option>
              <option value="driver">Printer's own setting</option>
            </Select>
          )}
        </Field>
        <Field label="Scale">
          {id => (
            <Select id={id} value={profile.fit} onChange={e => onProfile({ fit: e.target.value })}>
              <option value="page">Fit to page</option>
              <option value="actual">Actual size</option>
            </Select>
          )}
        </Field>
        {showDpi && (
          <Field label="Printer resolution" hint="Labels print one dot per printer dot. TVS LP 46 is 203 dpi.">
            {id => (
              <Select id={id} value={profile.dpi ?? 203} onChange={e => onProfile({ dpi: Number(e.target.value) })}>
                <option value={203}>203 dpi (most label printers)</option>
                <option value={300}>300 dpi</option>
              </Select>
            )}
          </Field>
        )}
        <Field label="Top margin (mm)">{id => <Input id={id} type="number" min="0" max="30" step="0.5" value={profile.top} onChange={num('top')} />}</Field>
        <Field label="Left margin (mm)">{id => <Input id={id} type="number" min="0" max="30" step="0.5" value={profile.left} onChange={num('left')} />}</Field>
      </fieldset>
      <div className="mt-3 flex items-center justify-between">
        <Button size="xs" variant="ghost" icon={RotateCcw} disabled={off} onClick={() => onProfile(DEFAULT_PROFILE)}>Reset</Button>
        <Button size="sm" icon={Printer} disabled={off || !onTest} onClick={onTest}>Test</Button>
      </div>
    </div>
  )
}
