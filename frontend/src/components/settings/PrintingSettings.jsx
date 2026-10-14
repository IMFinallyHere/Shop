import { useState } from 'react'
import { Printer } from 'lucide-react'
import { updateShopSettings } from '../../api/shopsettings'
import { PRINT_DEFAULTS, setPrintSettings } from '../../hooks/usePrintSettings'
import Section from './Section'
import Button from '../ui/Button'
import Switch from '../ui/Switch'
import SegmentedControl from '../ui/SegmentedControl'
import { Field, Input } from '../ui/Field'
import { useToast } from '../ui/Toast'
import ThermalLabel from '../inventory/ThermalLabel'
import PrintBarcodes from '../inventory/PrintBarcodes'
import BillReceipt from '../billing/BillReceipt'

const FIELDS = Object.keys(PRINT_DEFAULTS)
const LABEL_PRESETS = [[50, 25], [38, 25], [40, 30], [50, 30], [75, 50], [100, 50]]
const RECEIPT_WIDTHS = [{ value: 58, label: '58 mm' }, { value: 80, label: '80 mm' }, { value: 210, label: 'A4' }]

const SAMPLE_ITEM = { code: 'A1B2C3D4E5F6', product_name: 'Cotton Kurta', color_name: 'Maroon', size_name: 'XL', price: '1299.00' }
const sampleBill = () => ({
  number: 'INV-00042', created_at: new Date().toISOString(), customer_name: 'Test Customer', customer_phone: '9876543210',
  items: [
    { id: 1, product_name: 'Cotton Kurta', code: 'A1B2C3D4E5F6', unit_price: '1299.00' },
    { id: 2, product_name: 'Silk Dupatta', code: '0F9E8D7C6B5A', unit_price: '650.00' },
  ],
  subtotal: '1949.00', discount_amount: '0', tax_amount: '0', total: '1949.00', credit_used: '0', payment_mode: 'Cash', returns: [],
})

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
  const toast = useToast()

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
          <Field label="Paper width" className="mb-4">
            <div><SegmentedControl options={RECEIPT_WIDTHS} value={form.receipt_width_mm} onChange={set('receipt_width_mm')} /></div>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Shop name on receipt" hint="Leave blank to use the shop's name" error={errors.receipt_shop_name}>{id => <Input id={id} value={form.receipt_shop_name} onChange={setText('receipt_shop_name')} maxLength={100} />}</Field>
            <Field label="Phone" error={errors.receipt_phone}>{id => <Input id={id} value={form.receipt_phone} onChange={setText('receipt_phone')} maxLength={30} />}</Field>
            <Field label="Address" className="sm:col-span-2" error={errors.receipt_address}>{id => <Input id={id} value={form.receipt_address} onChange={setText('receipt_address')} maxLength={255} />}</Field>
            <Field label="GSTIN" error={errors.receipt_gstin}>{id => <Input id={id} value={form.receipt_gstin} onChange={e => set('receipt_gstin')(e.target.value.toUpperCase())} maxLength={20} />}</Field>
            <Field label="Footer" error={errors.receipt_footer}>{id => <Input id={id} value={form.receipt_footer} onChange={setText('receipt_footer')} maxLength={200} />}</Field>
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-2">
            <Toggle label="Open print dialog right after checkout" checked={form.auto_print_after_bill} onChange={set('auto_print_after_bill')} />
          </div>
          <div className="mt-3">
            <Button size="sm" icon={Printer} onClick={() => withForm(() => setTestReceipt(sampleBill()))}>Print test receipt</Button>
          </div>
        </Section>

        <div className="flex justify-end gap-2">
          {dirty && <Button onClick={() => setForm(saved)}>Discard</Button>}
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>Save print settings</Button>
        </div>

        <Section title="Printer setup (one time per laptop)">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-zinc-600">
            <li>Connect the printer by USB and install its driver from the maker's website (TSC, Zebra, Xprinter, TVS…). It should appear in System Settings → Printers.</li>
            <li>In the printer's settings, add a paper size matching your label ({W} × {H} mm) and, for receipts, the roll width.</li>
            <li>Calibrate the label gap: most printers do this when you hold the feed button until it beeps, or from the driver's utility.</li>
            <li>Click <b>Print test label</b>. In the print dialog pick the thermal printer, set Margins to <b>None</b> and Scale to <b>100%</b>. Chrome remembers these for next time.</li>
            <li>No printer yet? Choose <b>Save as PDF</b> in the dialog to check the size.</li>
          </ol>
        </Section>
      </form>

      {/* Outside the form: portal events still bubble through React's tree. */}
      {testLabel && <PrintBarcodes items={[SAMPLE_ITEM]} title="Test label" onClose={() => closeTest(() => setTestLabel(false))} />}
      <BillReceipt bill={testReceipt} onClose={() => closeTest(() => setTestReceipt(null))} />
    </>
  )
}
