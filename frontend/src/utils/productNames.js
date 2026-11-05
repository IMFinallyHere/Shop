// Suggested product names for a clothing shop: "<style> <fabric> <garment>", e.g.
// "Chikankari Georgette Kurti". Garments are paired only with fabrics and styles that
// make sense for them (no "Denim Saree"). Uses the form's category and fabric when set.

const ETHNIC_FABRICS = ['Cotton', 'Rayon', 'Silk', 'Georgette', 'Chiffon', 'Chanderi', 'Crepe', 'Muslin', 'Organza', 'Linen', 'Khadi', 'Velvet']
const WESTERN_FABRICS = ['Cotton', 'Linen', 'Rayon', 'Crepe', 'Georgette', 'Viscose', 'Polyester Blend']
const ETHNIC_STYLES = ['Printed', 'Embroidered', 'Chikankari', 'Floral', 'Bandhani', 'Block Print', 'Festive', 'Party Wear', 'Daily Wear', 'Zari Work', 'Mirror Work', 'Handloom', 'Leheriya', 'Gota Patti']
const WESTERN_STYLES = ['Printed', 'Solid', 'Striped', 'Checked', 'Floral', 'Casual', 'Formal', 'Slim Fit', 'Relaxed Fit', 'Classic']

// garment: [fabrics, styles]
const GARMENTS = {
  Kurti: [ETHNIC_FABRICS, [...ETHNIC_STYLES, 'A-line', 'Straight']],
  Kurta: [ETHNIC_FABRICS, [...ETHNIC_STYLES, 'Straight', 'Pathani']],
  'Kurta Set': [ETHNIC_FABRICS, ETHNIC_STYLES],
  Saree: [['Silk', 'Georgette', 'Chiffon', 'Cotton', 'Organza', 'Banarasi Silk', 'Kanjivaram Silk', 'Linen', 'Crepe', 'Net'], ETHNIC_STYLES],
  Lehenga: [['Silk', 'Georgette', 'Velvet', 'Net', 'Organza', 'Banarasi Silk'], ['Embroidered', 'Bridal', 'Festive', 'Zari Work', 'Mirror Work', 'Sequin', 'Party Wear']],
  'Salwar Suit': [ETHNIC_FABRICS, ETHNIC_STYLES],
  Anarkali: [['Georgette', 'Silk', 'Chiffon', 'Cotton', 'Velvet', 'Net'], ['Embroidered', 'Floral', 'Festive', 'Party Wear', 'Flared', 'Printed']],
  Dupatta: [['Chiffon', 'Georgette', 'Silk', 'Cotton', 'Chanderi', 'Net', 'Organza'], ['Bandhani', 'Phulkari', 'Embroidered', 'Printed', 'Gota Patti', 'Leheriya', 'Zari Border']],
  Palazzo: [['Rayon', 'Cotton', 'Crepe', 'Georgette', 'Linen'], ['Printed', 'Solid', 'Flared', 'Pleated', 'Daily Wear']],
  Sherwani: [['Silk', 'Velvet', 'Jacquard', 'Brocade'], ['Embroidered', 'Wedding', 'Festive', 'Royal', 'Zari Work']],
  'Nehru Jacket': [['Cotton', 'Linen', 'Silk', 'Jacquard', 'Khadi'], ['Solid', 'Printed', 'Festive', 'Classic', 'Textured']],
  Blouse: [['Silk', 'Cotton', 'Velvet', 'Brocade', 'Georgette'], ['Embroidered', 'Readymade', 'Designer', 'Sleeveless', 'Zari Work']],
  Stole: [['Cotton', 'Viscose', 'Wool', 'Pashmina', 'Silk'], ['Printed', 'Solid', 'Embroidered', 'Woven', 'Tasseled']],
  Gown: [['Georgette', 'Net', 'Satin', 'Velvet', 'Silk'], ['Party Wear', 'Embroidered', 'Flared', 'Evening', 'Sequin']],
  Shirt: [['Cotton', 'Linen', 'Oxford Cotton', 'Denim', 'Rayon'], WESTERN_STYLES],
  'T-Shirt': [['Cotton', 'Cotton Blend', 'Polyester Blend'], ['Graphic', 'Solid', 'Striped', 'Round Neck', 'Polo', 'Oversized']],
  Jeans: [['Denim', 'Stretch Denim'], ['Slim Fit', 'Straight Fit', 'Relaxed Fit', 'Skinny', 'Bootcut', 'Faded']],
  Trousers: [['Cotton', 'Linen', 'Poly Viscose', 'Twill'], ['Formal', 'Casual', 'Slim Fit', 'Pleated', 'Classic']],
  Top: [WESTERN_FABRICS, [...WESTERN_STYLES, 'Peplum', 'Crop', 'Ruffle']],
  Dress: [WESTERN_FABRICS, ['Floral', 'Printed', 'Solid', 'A-line', 'Maxi', 'Midi', 'Wrap', 'Party Wear']],
  Skirt: [['Cotton', 'Rayon', 'Denim', 'Georgette', 'Crepe'], ['Printed', 'Pleated', 'A-line', 'Flared', 'Midi', 'Maxi']],
  'Co-ord Set': [['Cotton', 'Linen', 'Rayon', 'Crepe'], ['Printed', 'Solid', 'Striped', 'Casual', 'Festive']],
  Leggings: [['Cotton Lycra', 'Viscose Lycra'], ['Ankle Length', 'Churidar', 'Solid', 'Stretch']],
}

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '').replace(/(es|s)$/, '')

// The garment a category names ("Kurtis" → Kurti, "Sarees" → Saree, "Men's Shirts" → Shirt).
function garmentFor(categoryName) {
  if (!categoryName) return null
  const c = norm(categoryName)
  const names = Object.keys(GARMENTS).sort((a, b) => b.length - a.length)  // "Kurta Set" before "Kurta"
  return names.find(g => c.includes(norm(g))) ?? null
}

export function suggestProductName({ categoryName = '', fabric = '' } = {}) {
  const garment = garmentFor(categoryName) ?? pick(Object.keys(GARMENTS))
  const [fabrics, styles] = GARMENTS[garment]
  const f = fabric.trim() || pick(fabrics)
  let style = pick(styles)
  if (style.toLowerCase() === f.toLowerCase()) style = pick(styles)
  return `${style} ${f} ${garment}`.replace(/\s+/g, ' ')
}
