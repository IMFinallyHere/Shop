// Blank forms and request bodies for categories and sellers (shared by their pages and the
// quick-add dialog in the product form).
export const EMPTY_CATEGORY = { name: '', description: '' }
export const EMPTY_SELLER = { name: '', phones: [''], email: '', address: '', notes: '' }
export const MAX_PHONES = 6  // the API accepts up to 6 numbers per seller

// Blank phone rows are ignored.
export const sellerBody = (form) => ({ ...form, phones: form.phones.map(n => n.trim()).filter(Boolean) })

// Same rule as the server: digits with an optional leading +, spaces/dashes/brackets between, 7-15 digits.
export const isValidPhone = (n) => /^\+?[\d\s\-()]+$/.test(n) && (n.match(/\d/g) || []).length >= 7 && (n.match(/\d/g) || []).length <= 15
// Client-side check before saving a seller; returns an errors object (empty = fine).
export function sellerErrors(form) {
  const bad = form.phones.map(n => n.trim()).find(n => n && !isValidPhone(n))
  return bad ? { phones: `"${bad}" is not a valid phone number. Use digits, and optionally +, spaces or dashes.` } : {}
}

// DRF error body → { fields: { <field>: 'first message' }, general: 'message for the top alert' }.
// Handles list errors ({phones: {0: ['…']}}), `detail` and `non_field_errors`.
export function parseApiErrors(e) {
  const d = e?.response?.data
  if (!d || typeof d !== 'object') {
    return { fields: {}, general: e?.response?.status === 403 ? "You don't have permission to do this." : 'Failed to save.' }
  }
  const first = (v) => (Array.isArray(v) ? first(v[0]) : v && typeof v === 'object' ? first(Object.values(v)[0]) : v)
  const fields = {}
  let general = typeof d.detail === 'string' ? d.detail : ''
  for (const [k, v] of Object.entries(d)) {
    const m = k === 'detail' ? '' : first(v)
    if (m) fields[k] = String(m)
  }
  if (fields.non_field_errors) { general = general || fields.non_field_errors; delete fields.non_field_errors }
  if (!general && !Object.keys(fields).length) general = 'Failed to save.'
  return { fields, general }
}
