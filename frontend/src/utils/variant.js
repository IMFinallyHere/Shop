// "Black / XL" from anything carrying color_name/size_name (variant, stock item, lookup result).
export const variantLabel = (v) => [v?.color_name, v?.size_name].filter(Boolean).join(' / ')

// A blank add-stock line. color/size are ids from Settings ('' = none).
export const EMPTY_LINE = { color: '', size: '', quantity: '', cost_price: '', price: '' }
