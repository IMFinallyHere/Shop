import { useEffect, useState } from 'react'
import { getShopSettings } from '../api/shopsettings'

// Mirrors the backend defaults so prints still look right before (or without) the fetch.
export const PRINT_DEFAULTS = {
  label_width_mm: 50, label_height_mm: 25,
  label_show_name: true, label_show_variant: true, label_show_price: true, label_show_code_text: true,
  label_copies: 1,
  receipt_width_mm: 80, receipt_shop_name: '', receipt_address: '', receipt_phone: '', receipt_gstin: '',
  receipt_footer: 'Thank you, visit again!', auto_print_after_bill: false,
}

// Shop settings are fetched once per page load and shared by every print component.
let cache = null
let inflight = null
const listeners = new Set()

// Call after saving settings so open components pick up the change.
export function setPrintSettings(data) {
  cache = { ...PRINT_DEFAULTS, ...data, loaded: true }
  listeners.forEach(l => l(cache))
}

export default function usePrintSettings() {
  const [settings, setSettings] = useState(cache ?? { ...PRINT_DEFAULTS, loaded: false })
  useEffect(() => {
    listeners.add(setSettings)
    if (!cache && !inflight) {
      inflight = getShopSettings()
        .then(r => setPrintSettings(r.data))
        .catch(() => setPrintSettings({}))  // fall back to defaults, but don't block auto-print forever
        .finally(() => { inflight = null })
    }
    return () => { listeners.delete(setSettings) }
  }, [])
  return settings
}
