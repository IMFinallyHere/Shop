import { useState } from 'react'
import { Printer } from 'lucide-react'
import { updateShopSettings } from '../../api/shopsettings'
import { PRINT_DEFAULTS, autoPrintableMm, setPrintSettings } from '../../hooks/usePrintSettings'
import Section from './Section'
import Button from '../ui/Button'
import Switch from '../ui/Switch'
import SegmentedControl from '../ui/SegmentedControl'
import { Field, Input, Textarea } from '../ui/Field'
import { useToast } from '../ui/Toast'
import { useAuth } from '../../contexts/AuthContext'
import ThermalLabel from '../inventory/ThermalLabel'
import PrintBarcodes from '../inventory/PrintBarcodes'
import BillReceipt from '../billing/BillReceipt'
import DirectPrintSettings from './DirectPrintSettings'

const FIELDS = Object.keys(PRINT_DEFAULTS)
const LABEL_PRESETS = [[50, 25], [38, 25], [40, 30], [50, 30], [75, 50], [100, 50]]
const RECEIPT_WIDTHS = [{ value: 58, label: '58 mm' }, { value: 80, label: '80 mm' }, { value: 210, label: 'A4' }]

const SAMPLE_ITEM = { code: 'A1B2C3D4E5F6', product_name: 'Cotton Kurta', color_name: 'Maroon', size_name: 'XL', price: '1299.00' }
// Sample bill for test prints: 3 pieces on Indian clothing slabs (two at 5%, one at 18%),
// in the shop's pricing mode, so the GST lines look like a real bill.
const SAMPLE_GST = {
  inclusive: {
    lines: [['1237.14', '61.86'], ['619.05', '30.95'], ['2711.86', '488.14']],
    summary: [['5.00', '1856.19', '92.81', '46.41', '46.40'], ['18.00', '2711.86', '488.14', '244.07', '244.07']],
    taxable: '4568.05', tax: '580.95', total: '5149.00',
  },
  exclusive: {
    lines: [['1299.00', '64.95'], ['650.00', '32.50'], ['3200.00', '576.00']],
    summary: [['5.00', '1949.00', '97.45', '48.73', '48.72'], ['18.00', '3200.00', '576.00', '288.00', '288.00']],
    taxable: '5149.00', tax: '673.45', total: '5822.45',
  },
}
const sampleBill = (shopName, inclusive = true) => {
  const g = SAMPLE_GST[inclusive ? 'inclusive' : 'exclusive']
  const items = [
    ['Cotton Kurta — Maroon / XL', 'A1B2C3D4E5F6', '1299.00', '5.00'],
    ['Silk Dupatta — Gold / Free Size', '0F9E8D7C6B5A', '650.00', '5.00'],
    ['Silk Lehenga — Red / M', '9C8B7A6F5E4D', '3200.00', '18.00'],
  ].map(([product_name, code, unit_price, tax_rate], i) => ({
    id: i + 1, product_name, code, unit_price, tax_rate, taxable_value: g.lines[i][0], tax_amount: g.lines[i][1],
  }))
  return {
    shop_name: shopName,
    number: 'INV-00042', created_at: new Date().toISOString(), customer_name: 'Test Customer', customer_phone: '9876543210',
    items, subtotal: '5149.00', discount_amount: '0', taxable_amount: g.taxable, tax_amount: g.tax, total: g.total,
    prices_include_tax: inclusive,
    gst_summary: g.summary.map(([rate, taxable, tax, cgst, sgst]) => ({ rate, taxable, tax, cgst, sgst })),
    credit_used: '0', payment_mode: 'Cash', returns: [],
  }
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm text-zinc-700">
      {label}
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  )
}

const pick = (s) => Object.fromEntries(FIELDS.map(k => [k, s[k] ?? PRINT_DEFAULTS[k]]))

export default function PrintingSettings({ initial, onSaved, onError }) {
  const [saved, setSaved] = useState(() => pick(initial))
  const [form, setForm] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [testLabel, setTestLabel] = useState(false)
  const [testReceipt, setTestReceipt] = useState(null)
  const [testAuto, setTestAuto] = useState(false)  // Test buttons under Direct printing print straight away
  const toast = useToast()
  const { user } = useAuth()

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }))
  const setNum = (k) => (e) => set(k)(e.target.value === '' ? '' : Number(e.target.value))
  const setText = (k) => (e) => set(k)(e.target.value)
  const dirty = FIELDS.some(k => form[k] !== saved[k])

  const save = async () => {
    setSaving(true); setErrors({})
    try {
      const { data } = await updateShopSettings(form)
      const next = pick(data)
      setSaved(next); setForm(next)
      setPrintSettings(data)
      onSaved?.(data)
      toast('Print settings saved')
    } catch (e) {
      const d = e.response?.data
      if (d && typeof d === 'object') setErrors(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])))
      onError('Failed to save print settings.')
    } finally { setSaving(false) }
  }

  // Test prints use the unsaved values, so you can try a size before committing to it.
  const withForm = (fn) => { setPrintSettings({ ...saved, ...form }); fn() }
  const closeTest = (fn) => { setPrintSettings(saved); fn() }

  const W = Number(form.label_width_mm) || PRINT_DEFAULTS.label_width_mm
  const H = Number(form.label_height_mm) || PRINT_DEFAULTS.label_height_mm

  return (
    <>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); save() }}>
        <Section title="Stock unit labels" description="Size of one sticker on your label roll. Each label prints on its own page, so the printer feeds exactly one sticker at a time.">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {LABEL_PRESETS.map(([w, h]) => (
              <button key={`${w}x${h}`} type="button" onClick={() => setForm(f => ({ ...f, label_width_mm: w, label_height_mm: h }))}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ring-1 transition-colors ${form.label_width_mm === w && form.label_height_mm === h ? 'bg-brand-50 text-brand-700 ring-brand-300' : 'text-zinc-600 ring-zinc-200 hover:bg-zinc-50'}`}>
                {w} × {h} mm
              </button>
            ))}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Width (mm)" error={errors.label_width_mm}>{id => <Input id={id} type="number" min="20" max="110" value={form.label_width_mm} onChange={setNum('label_width_mm')} />}</Field>
                <Field label="Height (mm)" error={errors.label_height_mm}>{id => <Input id={id} type="number" min="10" max="150" value={form.label_height_mm} onChange={setNum('label_height_mm')} />}</Field>
                <Field label="Copies" error={errors.label_copies}>{id => <Input id={id} type="number" min="1" max="10" value={form.label_copies} onChange={setNum('label_copies')} />}</Field>
              </div>
              <div className="mt-3 divide-y divide-zinc-100">
                <Toggle label="Product name" checked={form.label_show_name} onChange={set('label_show_name')} />
                <Toggle label="Color / size" checked={form.label_show_variant} onChange={set('label_show_variant')} />
                <Toggle label="Price" checked={form.label_show_price} onChange={set('label_show_price')} />
                <Toggle label="Code under barcode" checked={form.label_show_code_text} onChange={set('label_show_code_text')} />
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-zinc-50 p-4">
              <ThermalLabel item={SAMPLE_ITEM} settings={{ ...form, label_width_mm: W, label_height_mm: H }} className="rounded-sm shadow-card outline outline-1 outline-zinc-200" />
              <div className="text-xs text-zinc-500">Actual size preview</div>
              <Button size="sm" icon={Printer} onClick={() => withForm(() => setTestLabel(true))}>Print test label</Button>
            </div>
          </div>
        </Section>

        <Section title="Receipts" description="Paper for bills and credit notes. Thermal rolls print one continuous strip as long as the receipt.">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field label="Paper width">
              <div><SegmentedControl options={RECEIPT_WIDTHS} value={form.receipt_width_mm} onChange={set('receipt_width_mm')} /></div>
            </Field>
            {form.receipt_width_mm < 210 && (
              <Field label="Printable width (mm)" error={errors.receipt_printable_mm}
                hint={`From the printer's spec sheet. Most 80 mm printers print 72 mm, 58 mm printers 48 mm. Blank uses ${autoPrintableMm(form.receipt_width_mm)} mm.`}>
                {id => <Input id={id} type="number" min="30" max={form.receipt_width_mm} placeholder={String(autoPrintableMm(form.receipt_width_mm))}
                  value={form.receipt_printable_mm ?? ''} onChange={e => set('receipt_printable_mm')(e.target.value === '' ? null : Number(e.target.value))} />}
              </Field>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Shop name on receipt" hint="Leave blank to use the shop's name" error={errors.receipt_shop_name}>{id => <Input id={id} value={form.receipt_shop_name} onChange={setText('receipt_shop_name')} maxLength={100} />}</Field>
            <Field label="Phone" error={errors.receipt_phone}>{id => <Input id={id} value={form.receipt_phone} onChange={setText('receipt_phone')} maxLength={30} />}</Field>
            <Field label="Address" className="sm:col-span-2" hint="Press Enter to start a new line on the receipt (up to 4 lines)." error={errors.receipt_address}>{id => <Textarea id={id} rows={3} value={form.receipt_address} onChange={setText('receipt_address')} maxLength={255} />}</Field>
            <Field label="GSTIN" error={errors.receipt_gstin}>{id => <Input id={id} value={form.receipt_gstin} onChange={e => set('receipt_gstin')(e.target.value.toUpperCase())} maxLength={20} />}</Field>
            <Field label="Footer" className="sm:col-span-2" hint="Press Enter for a new line (up to 4 lines)." error={errors.receipt_footer}>{id => <Textarea id={id} rows={2} value={form.receipt_footer} onChange={setText('receipt_footer')} maxLength={200} />}</Field>
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-2">
            <Toggle label="Open print dialog right after checkout" checked={form.auto_print_after_bill} onChange={set('auto_print_after_bill')} />
          </div>
          <div className="mt-3">
            <Button size="sm" icon={Printer} onClick={() => withForm(() => setTestReceipt(sampleBill(user?.shop_name, initial?.prices_include_tax ?? true)))}>Print test receipt</Button>
          </div>
        </Section>

        <div className="flex justify-end gap-2">
          {dirty && <Button onClick={() => setForm(saved)}>Discard</Button>}
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>Save print settings</Button>
        </div>

        <DirectPrintSettings
          onTestReceipt={() => withForm(() => { setTestAuto(true); setTestReceipt(sampleBill(user?.shop_name, initial?.prices_include_tax ?? true)) })}
          onTestLabel={() => withForm(() => { setTestAuto(true); setTestLabel(true) })}
        />

        <Section title="Printer setup (one time per laptop)">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-600">
            <li>Connect the printer by USB and install its driver from the maker's website (TSC, Zebra, Xprinter, TVS…). It should appear in System Settings → Printers.</li>
            <li>In the printer's settings, add a paper size matching your label ({W} × {H} mm) and, for receipts, the roll width (e.g. 80 mm).</li>
            <li>Calibrate the label gap: most printers do this when you hold the feed button until it beeps, or from the driver's utility.</li>
            <li>Click <b>Print test label</b> / <b>Print test receipt</b>. In the print dialog pick the thermal printer, set Margins to <b>None</b> and Scale to <b>100%</b> (not "Fit to page"). Chrome remembers these for next time.</li>
            <li>Receipt cut off on the right? Lower <b>Printable width</b> by 2 mm and print a test again. Big empty strip on the right? Raise it.</li>
            <li>No printer yet? Choose <b>Save as PDF</b> in the dialog to check the size.</li>
            <li>Tired of switching printers in the dialog? Set up <b>Direct printing</b> above.</li>
          </ol>
        </Section>
      </form>

      {/* Outside the form: portal events still bubble through React's tree. */}
      {testLabel && <PrintBarcodes items={[SAMPLE_ITEM]} title="Test label" autoPrint={testAuto} onClose={() => closeTest(() => { setTestLabel(false); setTestAuto(false) })} />}
      <BillReceipt bill={testReceipt} autoPrint={testAuto} onClose={() => closeTest(() => { setTestReceipt(null); setTestAuto(false) })} />
    </>
  )
}
