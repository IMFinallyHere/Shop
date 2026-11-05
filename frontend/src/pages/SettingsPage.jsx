import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getShopSettings,
  getPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod,
  getSizes, createSize, updateSize, deleteSize,
  getColors, createColor, updateColor, deleteColor,
} from '../api/shopsettings'
import OptionList from '../components/settings/OptionList'
import GstSettings from '../components/settings/GstSettings'
import ProductSettings from '../components/settings/ProductSettings'
import Section from '../components/settings/Section'
import PrintingSettings from '../components/settings/PrintingSettings'
import Spinner from '../components/common/Spinner'
import ErrorAlert from '../components/common/ErrorAlert'
import PageHeader from '../components/ui/PageHeader'
import Tabs from '../components/ui/Tabs'

const TABS = [
  { value: 'general', label: 'Billing & tax' },
  { value: 'payments', label: 'Payment methods' },
  { value: 'products', label: 'Products' },
  { value: 'sizes', label: 'Sizes' },
  { value: 'colors', label: 'Colors' },
  { value: 'printing', label: 'Printing' },
]

const sizeApi = { create: createSize, update: updateSize, remove: deleteSize }
const colorApi = { create: createColor, update: updateColor, remove: deleteColor }
const methodApi = { create: createPaymentMethod, update: updatePaymentMethod, remove: deletePaymentMethod }

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(t => t.value === params.get('tab')) ? params.get('tab') : 'general'
  const setTab = (t) => setParams(t === 'general' ? {} : { tab: t }, { replace: true })
  const [shopSettings, setShopSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [methods, setMethods] = useState([])
  const [sizes, setSizes] = useState([])
  const [colors, setColors] = useState([])

  useEffect(() => {
    Promise.all([getShopSettings(), getPaymentMethods(), getSizes(), getColors()])
      .then(([s, m, sz, c]) => {
        setShopSettings(s.data)
        setMethods(m.data.results ?? m.data)
        setSizes(sz.data); setColors(c.data)
      })
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false))
  }, [])

  const refreshMethods = () => getPaymentMethods().then(m => setMethods(m.data.results ?? m.data))
  const refreshSizes = () => getSizes().then(r => setSizes(r.data))
  const refreshColors = () => getColors().then(r => setColors(r.data))

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="How billing, stock and printing work in this shop." />
      <Tabs tabs={TABS} value={tab} onChange={t => { setTab(t); setError('') }} />
      <ErrorAlert message={error} onDismiss={() => setError('')} />

      {loading ? <Spinner /> : (<>
        {tab === 'general' && (
          <GstSettings initial={shopSettings} onSaved={setShopSettings} onError={setError} />
        )}

        {tab === 'payments' && (
          <Section title="Payment methods" description="Offered at checkout and for refunds. Turn one off to hide it from new bills without deleting history.">
            <OptionList items={methods} api={methodApi} onChange={refreshMethods} onError={setError} placeholder="Add a method (e.g. Paytm)" reorder={false} />
          </Section>
        )}

        {tab === 'products' && <ProductSettings initial={shopSettings} onSaved={setShopSettings} onError={setError} />}

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

        {tab === 'printing' && shopSettings && (
          <PrintingSettings initial={shopSettings} onSaved={setShopSettings} onError={setError} />
        )}
      </>)}
    </div>
  )
}
