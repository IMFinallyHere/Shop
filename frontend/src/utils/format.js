// ₹1,234.50 — always two decimals (bills, totals).
export const money = (v) => (v == null || v === '' ? '—'
  : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

// ₹1,234 / ₹1,234.5 — compact, for prices and dashboard figures.
export const moneyShort = (v) => (v == null || v === '' ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export const formatDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
}) : '—')

export const displayName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.email || ''

export const initials = (name) => (name || '').split(/[\s@.]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('')
