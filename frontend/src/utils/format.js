// ₹1,234.50 — always two decimals (bills, totals).
export const money = (v) => (v == null || v === '' ? '—'
  : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

// ₹1,234 / ₹1,234.50 — compact, for prices and dashboard figures: whole rupees drop the
// paise, anything else always shows two places (never ₹1,234.5).
export const moneyShort = (v) => {
  if (v == null || v === '') return '—'
  const n = Number(v)
  const places = Number.isInteger(n) ? 0 : 2
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: places, maximumFractionDigits: places })}`
}

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export const formatDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
}) : '—')

export const displayName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.email || ''

export const initials = (name) => (name || '').split(/[\s@.]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('')
