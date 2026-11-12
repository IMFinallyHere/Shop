// With "Hide product name" on, nothing in the UI shows a product's name.
//  - Anything about one physical unit (stock list, POS cart, returns, search) shows our unit code.
//  - Product-level places have no unit code, so they show a neutral label: "Silk Sarees #12".
//    It is built from fabric/category + the product id, never from the stored name.
export const productLabel = ({ id, fabric_type, category_name } = {}) =>
  `${[fabric_type, category_name].filter(Boolean).join(' ') || 'Product'} #${id}`

// Title for a unit-level row: the code when names are hidden, else the product name.
export const unitTitle = (name, code, hide) => (hide ? code : name)
