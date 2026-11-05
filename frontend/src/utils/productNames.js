// Suggested product names that never guess what the product is.
//
// A neutral design name ("Gulmohar 27") plus only what the user actually chose: the
// fabric they typed and the garment their category names. A random garment or fabric
// could be wrong ("… Kurti" on a pair of trousers), so nothing is invented.
//
//   newBaseName()                                   → "Gulmohar 27"
//   productName("Gulmohar 27", {})                  → "Gulmohar 27"
//   productName("Gulmohar 27", { categoryName: 'Pants', fabric: 'Linen' }) → "Gulmohar 27 Linen Pant"

// Flowers, gems and poetic Hindi/Urdu names: pleasant, and say nothing about the garment.
const DESIGN_WORDS = [
  'Gulmohar', 'Aarohi', 'Noor', 'Kesar', 'Chandni', 'Mehr', 'Saanjh', 'Inaya', 'Zoya', 'Rangoli',
  'Mogra', 'Champa', 'Chameli', 'Gulab', 'Kamal', 'Juhi', 'Rajnigandha', 'Palash', 'Bakul', 'Kadamb',
  'Moti', 'Panna', 'Neelam', 'Heera', 'Manik', 'Pukhraj', 'Firoza', 'Sona', 'Chandan', 'Kumkum',
  'Aabha', 'Aditi', 'Anvi', 'Ira', 'Kavya', 'Meera', 'Naina', 'Riya', 'Siya', 'Tara',
  'Barkha', 'Basant', 'Sawan', 'Phagun', 'Ujala', 'Roshni', 'Jharna', 'Lehar', 'Megha', 'Taara',
]

// Category → the garment word to show ("Kurtis" → Kurti, "Men's Shirts" → Shirt).
const GARMENTS = [
  'Kurta Set', 'Salwar Suit', 'Co-ord Set', 'Nehru Jacket', 'T-Shirt', 'Night Suit',
  'Kurti', 'Kurta', 'Saree', 'Lehenga', 'Anarkali', 'Dupatta', 'Palazzo', 'Sherwani', 'Blouse',
  'Stole', 'Gown', 'Shirt', 'Jeans', 'Trousers', 'Pant', 'Top', 'Dress', 'Skirt', 'Leggings',
  'Shorts', 'Jacket', 'Sweater', 'Hoodie', 'Shawl', 'Dhoti', 'Pyjama', 'Churidar', 'Tunic',
]

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, '')  // "Sarees" → "saree"

function garmentFor(categoryName) {
  const c = norm(categoryName || '')
  if (!c) return ''
  const known = [...GARMENTS].sort((a, b) => b.length - a.length)  // "Kurta Set" before "Kurta"
  // A category that isn't a garment we know (e.g. "Kids", "New Arrivals") adds nothing.
  return known.find(g => c.includes(norm(g))) ?? ''
}

export function newBaseName() {
  return `${pick(DESIGN_WORDS)} ${String(10 + Math.floor(Math.random() * 90))}`
}

export function productName(base, { categoryName = '', fabric = '' } = {}) {
  return [base, fabric.trim(), garmentFor(categoryName)].filter(Boolean).join(' ')
}
