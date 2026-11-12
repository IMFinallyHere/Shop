import { useState } from 'react'
import Section from './Section'
import Switch from '../ui/Switch'
import { updateShopSettings } from '../../api/shopsettings'
import { setPrintSettings } from '../../hooks/usePrintSettings'
import { useToast } from '../ui/Toast'
import { newBaseName, productName } from '../../utils/productNames'

// One row per boolean: [setting key, title, description]. Each saves as soon as it's switched.
const ROWS = [
  ['one_time_stock_default', 'One-time stock by default',
    'New products start marked “one-time”: once their stock sells out they move to Inactive. You can change it per product.'],
  ['hide_product_name', 'Hide product name',
    'Skip the name when adding products and hide the name column. Products are named automatically from fabric and category.'],
  ['require_category', 'Category is mandatory', 'A product can’t be saved without a category.'],
  ['require_seller', 'Seller is mandatory', 'A product can’t be saved without a seller.'],
  ['require_cost_price', 'Cost price is mandatory', 'Every stock line needs a cost price.'],
]

// Product-form preferences. Saved as soon as they're switched.
export default function ProductSettings({ initial, onSaved, onError }) {
  const [values, setValues] = useState(() => Object.fromEntries(
    ['auto_product_names', ...ROWS.map(r => r[0])].map(k => [k, !!initial[k]])))
  const [example] = useState(() => { const b = newBaseName(); return [b, productName(b, { categoryName: 'Pants', fabric: 'Linen' })] })
  const toast = useToast()

  const toggle = (key, message) => async (v) => {
    setValues(s => ({ ...s, [key]: v }))
    try {
      const { data } = await updateShopSettings({ [key]: v })
      setPrintSettings(data)  // shared settings cache read by the Products page
      onSaved?.(data)
      toast(message ?? 'Saved')
    } catch {
      setValues(s => ({ ...s, [key]: !v }))
      onError?.('Failed to save product settings.')
    }
  }

  const row = (key, title, description, message) => (
    <label key={key} className="flex cursor-pointer items-start justify-between gap-4 text-sm text-zinc-700">
      <span>
        <span className="font-medium text-zinc-900">{title}</span>
        <span className="block text-xs text-zinc-500">{description}</span>
      </span>
      <Switch checked={values[key]} onChange={toggle(key, message)} label={title} />
    </label>
  )

  return (
    <div className="space-y-6">
      <Section title="Product names" description="Speed up adding products. You can always edit the name before saving.">
        {row('auto_product_names', 'Suggest a name for new products',
          `Fills a neutral design name as soon as you click New product, like “${example[0]}”. It never guesses the garment: only the fabric you type and the category you pick are added (“${example[1]}”).`,
          values.auto_product_names ? 'Product name suggestions off' : 'Product names will be suggested')}
      </Section>
      <Section title="Adding products" description="Defaults and required fields for new products and stock.">
        <div className="space-y-4">{ROWS.map(([k, t, d]) => row(k, t, d))}</div>
      </Section>
    </div>
  )
}
