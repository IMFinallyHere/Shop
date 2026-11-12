import { useEffect, useState } from 'react'
import { getShopSettings } from '../api/shopsettings'

// Mirrors the backend defaults so prints still look right before (or without) the fetch.
export const PRINT_DEFAULTS = {
  label_width_mm: 50, label_height_mm: 25,
  label_show_name: true, label_show_variant: true, label_show_price: true, label_show_code_text: true,
  label_copies: 1,
  receipt_width_mm: 80, receipt_printable_mm: null, receipt_shop_name: '', receipt_address: '', receipt_phone: '', receipt_gstin: '',
  receipt_footer: 'Thank you, visit again!', auto_print_after_bill: false, receipt_show_invoice_barcode: true,
  one_time_stock_default: false, hide_product_name: false,
  require_category: false, require_seller: false, require_cost_price: false,
}

// A thermal head doesn't cover the whole roll: 80 mm paper typically prints 72 mm (576 dots),
// 58 mm prints 48 mm (384 dots). Receipts are laid out at this width so nothing gets clipped.
const TYPICAL_PRINTABLE = { 80: 72, 58: 48 }
export const autoPrintableMm = (paper) => TYPICAL_PRINTABLE[Number(paper)] ?? Number(paper)
export const receiptPrintableMm = (s) => Number(s.receipt_printable_mm) || autoPrintableMm(s.receipt_width_mm)

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
