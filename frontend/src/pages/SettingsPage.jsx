import { useEffect, useState } from 'react'
import { Percent } from 'lucide-react'
import {
  getShopSettings, updateShopSettings,
  getPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod,
  getSizes, createSize, updateSize, deleteSize,
  getColors, createColor, updateColor, deleteColor,
} from '../api/shopsettings'
import OptionList from '../components/settings/OptionList'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import Tabs from '../components/ui/Tabs'
import { useToast } from '../components/ui/Toast'

const TABS = [
  { value: 'general', label: 'Billing & tax' },
  { value: 'payments', label: 'Payment methods' },
  { value: 'sizes', label: 'Sizes' },
  { value: 'colors', label: 'Colors' },
]

const sizeApi = { create: createSize, update: updateSize, remove: deleteSize }
const colorApi = { create: createColor, update: updateColor, remove: deleteColor }
const methodApi = { create: createPaymentMethod, update: updatePaymentMethod, remove: deletePaymentMethod }

function Section({ title, description, children }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      {description && <p className="mb-4 mt-1 text-sm text-zinc-500">{description}</p>}
      {children}
    </Card>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [taxRate, setTaxRate] = useState('')
  const [savedTax, setSavedTax] = useState('')
  const [savingTax, setSavingTax] = useState(false)
  const [methods, setMethods] = useState([])
  const [sizes, setSizes] = useState([])
  const [colors, setColors] = useState([])
  const toast = useToast()

  useEffect(() => {
    Promise.all([getShopSettings(), getPaymentMethods(), getSizes(), getColors()])
      .then(([s, m, sz, c]) => {
        setTaxRate(s.data.default_tax_rate); setSavedTax(s.data.default_tax_rate)
        setMethods(m.data.results ?? m.data)
        setSizes(sz.data); setColors(c.data)
      })
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false))
  }, [])

  const saveTax = async () => {
    setSavingTax(true); setError('')
    try {
      const { data } = await updateShopSettings({ default_tax_rate: taxRate || 0 })
      setSavedTax(data.default_tax_rate); setTaxRate(data.default_tax_rate)
      toast('Tax rate saved')
    } catch { setError('Failed to save tax rate.') }
    finally { setSavingTax(false) }
  }

  const refreshMethods = () => getPaymentMethods().then(m => setMethods(m.data.results ?? m.data))
  const refreshSizes = () => getSizes().then(r => setSizes(r.data))
  const refreshColors = () => getColors().then(r => setColors(r.data))

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="How billing and stock work in this shop." />
      <Tabs tabs={TABS} value={tab} onChange={t => { setTab(t); setError('') }} />
      <ErrorAlert message={error} onDismiss={() => setError('')} />

      {loading ? <Spinner /> : (<>
        {tab === 'general' && (
          <Section title="Default tax (GST)" description="Applied automatically to every bill. Cashiers can't change this at the counter.">
            <form className="flex items-center gap-3" onSubmit={e => { e.preventDefault(); saveTax() }}>
              <div className="relative">
                <input type="number" min="0" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} aria-label="Tax rate"
                  className="input w-32 pr-8" />
                <Percent size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              </div>
              <Button type="submit" variant="primary" loading={savingTax} disabled={taxRate === savedTax}>Save</Button>
            </form>
          </Section>
        )}

        {tab === 'payments' && (
          <Section title="Payment methods" description="Offered at checkout and for refunds. Turn one off to hide it from new bills without deleting history.">
            <OptionList items={methods} api={methodApi} onChange={refreshMethods} onError={setError} placeholder="Add a method (e.g. Paytm)" reorder={false} />
          </Section>
        )}

        {tab === 'sizes' && (
          <Section title="Sizes" description="Offered when adding stock, in this order. Renaming updates every product that uses it; sizes in use can be turned off but not deleted.">
            <OptionList items={sizes} api={sizeApi} onChange={refreshSizes} onError={setError} placeholder="Add a size (e.g. 4XL, 32)" />
          </Section>
        )}

        {tab === 'colors' && (
          <Section title="Colors" description="Offered when adding stock. Click a swatch to change it. Colors in use can be turned off but not deleted.">
            <OptionList items={colors} api={colorApi} onChange={refreshColors} onError={setError} placeholder="Add a color (e.g. Maroon)" withHex />
          </Section>
        )}
      </>)}
    </div>
  )
}
