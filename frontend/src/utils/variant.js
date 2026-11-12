// "Black / XL" from anything carrying color_name/size_name (variant, stock item, lookup result).
export const variantLabel = (v) => [v?.color_name, v?.size_name].filter(Boolean).join(' / ')

// Bill/return lines snapshot the name as "Tee — Black / XL". With product names hidden, receipts
// show only our unit code, so this keeps just the "Black / XL" part (blank if there is none).
export const variantPart = (productName) => {
  const i = (productName ?? '').indexOf(' — ')
  return i === -1 ? '' : productName.slice(i + 3)
}

// A blank add-stock line. color/size are ids from Settings ('' = none).
// `margin` is a UI-only helper (markup % on cost); it is never sent to the API.
export const EMPTY_LINE = { color: '', size: '', quantity: '', cost_price: '', price: '', margin: '' }

export const MAX_LINES = 50  // the API accepts at most 50 lines per request

const round2 = (n) => String(Math.round(n * 100) / 100)

// Markup on cost: price = cost × (1 + m/100). '' when it can't be worked out.
export const priceFromMargin = (cost, margin) =>
  cost === '' || margin === '' || !(Number(cost) > 0) || Number.isNaN(Number(margin)) ? '' : round2(Number(cost) * (1 + Number(margin) / 100))

// margin % = (price − cost) / cost × 100
export const marginFromPrice = (cost, price) =>
  cost === '' || price === '' || !(Number(cost) > 0) ? '' : round2(((Number(price) - Number(cost)) / Number(cost)) * 100)

// Strip UI-only fields and blanks before sending lines to the API.
export const toStockPayload = (lines) => lines.map(l => ({
  color: l.color || null, size: l.size || null, quantity: l.quantity, price: l.price,
  cost_price: l.cost_price === '' ? null : l.cost_price,
}))
