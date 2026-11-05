import { useState } from 'react'
import Section from './Section'
import Switch from '../ui/Switch'
import { updateShopSettings } from '../../api/shopsettings'
import { setPrintSettings } from '../../hooks/usePrintSettings'
import { useToast } from '../ui/Toast'
import { suggestProductName } from '../../utils/productNames'

// Product-form preferences. Saved as soon as they're switched.
export default function ProductSettings({ initial, onSaved, onError }) {
  const [auto, setAuto] = useState(!!initial.auto_product_names)
  const [example] = useState(() => [suggestProductName(), suggestProductName({ categoryName: 'Sarees' })])
  const toast = useToast()

  const toggle = async (v) => {
    setAuto(v)
    try {
      const { data } = await updateShopSettings({ auto_product_names: v })
      setPrintSettings(data)  // shared settings cache read by the Products page
      onSaved?.(data)
      toast(v ? 'Product names will be suggested' : 'Product name suggestions off')
    } catch {
      setAuto(!v)
      onError?.('Failed to save product settings.')
    }
  }

  return (
    <Section title="Product names" description="Speed up adding products. You can always edit the name before saving.">
      <label className="flex cursor-pointer items-start justify-between gap-4 text-sm text-zinc-700">
        <span>
          <span className="font-medium text-zinc-900">Suggest a name for new products</span>
          <span className="block text-xs text-zinc-500">
            Fills the name as soon as you click New product, using the category and fabric when you pick them.
            For example: “{example[0]}”, “{example[1]}”.
          </span>
        </span>
        <Switch checked={auto} onChange={toggle} label="Suggest a name for new products" />
      </label>
    </Section>
  )
}
