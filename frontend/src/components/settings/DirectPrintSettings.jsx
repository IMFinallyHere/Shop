import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import Section from './Section'
import Button from '../ui/Button'
import Switch from '../ui/Switch'
import { Field, Select } from '../ui/Field'
import { getDirectPrefs, listPrinters, setDirectPrefs } from '../../utils/directPrint'

// Per-laptop printer routing through QZ Tray. Saved in this browser right away
// (printer names differ between laptops), separate from the shop's print settings.
export default function DirectPrintSettings() {
  const [prefs, setPrefs] = useState(getDirectPrefs)
  const [status, setStatus] = useState('checking')  // checking | connected | offline
  const [printers, setPrinters] = useState([])

  const check = useCallback(() => listPrinters()
    .then(list => { setPrinters(list); setStatus('connected') })
    .catch(() => setStatus('offline')), [])
  useEffect(() => { check() }, [check])
  const refresh = () => { setStatus('checking'); check() }

  const update = (patch) => setPrefs(p => { const next = { ...p, ...patch }; setDirectPrefs(next); return next })

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

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Receipt printer" hint="Bills and credit notes (thermal roll)">
          {id => (
            <Select id={id} value={prefs.receiptPrinter} onChange={e => update({ receiptPrinter: e.target.value })} disabled={!prefs.enabled}>
              <option value="">Use the print dialog</option>
              {options(prefs.receiptPrinter).map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Label printer" hint="Barcode stickers">
          {id => (
            <Select id={id} value={prefs.labelPrinter} onChange={e => update({ labelPrinter: e.target.value })} disabled={!prefs.enabled}>
              <option value="">Use the print dialog</option>
              {options(prefs.labelPrinter).map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          )}
        </Field>
      </div>

      <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-zinc-500">
        <li>Install QZ Tray from qz.io/download and leave it running (it starts with the laptop).</li>
        <li>Come back here, click Retry, switch on direct printing and pick the two printers.</li>
        <li>Print a test receipt and a test label. Allow the "local network" prompt from Chrome, and in QZ Tray's prompt tick <b>Remember this decision</b> and click <b>Allow</b>. Both are one-time.</li>
      </ol>
    </Section>
  )
}
