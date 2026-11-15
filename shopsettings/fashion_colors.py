"""The fashion-industry colour palette (name, swatch hex) a shop starts with.

Grouped by family so the Settings list reads sensibly. `shopsettings.models.DEFAULT_COLORS`
puts the everyday colours first and appends these (skipping names it already has).
Names are unique ignoring case; every hex is `#rrggbb`.
"""

FASHION_COLORS = [
    # Neutrals: black, white, grey
    ("Jet Black", "#0a0a0a"), ("Charcoal", "#36454f"), ("Charcoal Grey", "#4a4f55"), ("Graphite", "#41424c"),
    ("Slate", "#5d6770"), ("Slate Grey", "#708090"), ("Steel Grey", "#7b8794"), ("Ash Grey", "#b2beb5"),
    ("Dark Grey", "#4d4d4d"), ("Light Grey", "#d3d3d3"), ("Grey Melange", "#a6a6a6"), ("Heather Grey", "#b6b8bd"),
    ("Dove Grey", "#c8c8c8"), ("Pewter", "#8e9196"), ("Gunmetal", "#2c3539"), ("Smoke", "#9aa0a6"),
    ("Snow White", "#fffafa"), ("Pure White", "#ffffff"), ("Ivory", "#fffff0"), ("Pearl", "#eae0c8"),
    ("Chalk", "#f2efe6"), ("Ecru", "#c2b280"), ("Bone", "#e3dac9"), ("Vanilla", "#f3e5ab"),
    # Creams, beiges, browns
    ("Champagne", "#f7e7ce"), ("Buttercream", "#fdf1b8"), ("Sand", "#c2b280"), ("Sandstone", "#c9ad88"),
    ("Biscuit", "#e4c9a0"), ("Oatmeal", "#d3c4a8"), ("Linen", "#faf0e6"), ("Nude", "#e3bc9a"),
    ("Taupe", "#8b7765"), ("Mushroom", "#b7a99a"), ("Stone", "#a89f91"), ("Khaki", "#b5a272"),
    ("Camel", "#c19a6b"), ("Tan", "#d2b48c"), ("Fawn", "#e5aa70"), ("Caramel", "#af6e4d"),
    ("Toffee", "#8a5a3c"), ("Cinnamon", "#a0522d"), ("Copper", "#b87333"), ("Bronze", "#8c6b32"),
    ("Chestnut", "#954535"), ("Walnut", "#5c4033"), ("Coffee", "#4b3621"), ("Mocha", "#6b4b3a"),
    ("Chocolate", "#4a2c1d"), ("Espresso", "#3b2417"), ("Dark Brown", "#3d2314"), ("Rust", "#b7410e"),
    ("Terracotta", "#c8553d"), ("Brick", "#a0442c"), ("Sienna", "#8f4a2b"), ("Umber", "#635147"),
    ("Cocoa", "#6f4e37"), ("Hazelnut", "#a67b5b"), ("Almond", "#e8d2b0"), ("Mink", "#8b7d6b"),
    # Reds
    ("Scarlet", "#ff2400"), ("Crimson", "#b81234"), ("Cherry Red", "#c3112e"), ("Ruby", "#9b111e"),
    ("Burgundy", "#6d0f26"), ("Oxblood", "#4a0404"), ("Claret", "#7f1734"), ("Brick Red", "#a63a2b"),
    ("Tomato Red", "#e2432f"), ("Coral Red", "#ff4040"), ("Vermilion", "#e34234"), ("Cardinal Red", "#a8132e"),
    ("Fire Red", "#d62812"), ("Lipstick Red", "#c2112a"), ("Blood Red", "#660000"), ("Garnet", "#733635"),
    ("Cranberry", "#9f1d35"), ("Raspberry", "#b3173f"), ("Pomegranate", "#a01c2b"), ("Rosewood", "#65000b"),
    ("Mahogany", "#4e1609"), ("Sindoor", "#e0301e"), ("Lal", "#cc1c24"), ("Kumkum", "#c4161c"),
    # Pinks
    ("Baby Pink", "#f8c8dc"), ("Light Pink", "#ffb6c1"), ("Blush", "#f4c2c2"), ("Blush Pink", "#e8a5a5"),
    ("Dusty Pink", "#d4a0a7"), ("Powder Pink", "#f2c9d1"), ("Rose", "#e8607a"), ("Rose Pink", "#f27f9d"),
    ("Old Rose", "#c08081"), ("Rose Gold", "#b76e79"), ("Salmon", "#fa8072"), ("Salmon Pink", "#f48b8b"),
    ("Coral", "#f26b5b"), ("Coral Pink", "#f88379"), ("Watermelon", "#f0595f"), ("Flamingo", "#fc8eac"),
    ("Bubblegum Pink", "#ff85b3"), ("Candy Pink", "#f78fb3"), ("Hot Pink", "#ff4f9a"), ("Fuchsia", "#d9248b"),
    ("Magenta", "#c71585"), ("Rani Pink", "#e0197d"), ("Shocking Pink", "#fc0fc0"), ("Barbie Pink", "#e0218a"),
    ("Onion Pink", "#d9a0a0"), ("Mauve Pink", "#d39bb0"), ("Peony", "#e86a92"), ("Strawberry", "#d7385e"),
    ("Carnation", "#f98dab"), ("Orchid Pink", "#ec9fc0"), ("Tea Rose", "#f4c0b5"), ("Petal Pink", "#f7cfd8"),
    # Oranges and peaches
    ("Apricot", "#fbceb1"), ("Light Peach", "#fde0cc"), ("Dark Peach", "#f4a084"), ("Melon", "#fdbcb4"),
    ("Tangerine", "#f28500"), ("Burnt Orange", "#cc5500"), ("Dark Orange", "#e66a00"), ("Saffron", "#f4a300"),
    ("Kesari", "#ff9933"), ("Carrot", "#ed9121"), ("Pumpkin", "#ff7518"), ("Amber", "#ffbf00"),
    ("Papaya", "#ffa07a"), ("Mango", "#ffb02e"), ("Marigold", "#f5a31a"), ("Ginger", "#c97a2b"),
    ("Sunset Orange", "#fd5e53"), ("Neon Orange", "#ff6700"), ("Persimmon", "#ec5800"), ("Clay", "#b66a50"),
    # Yellows
    ("Lemon", "#fff44f"), ("Lemon Yellow", "#fde910"), ("Pastel Yellow", "#fdfd96"), ("Butter Yellow", "#fbe9a0"),
    ("Canary Yellow", "#ffef00"), ("Sunflower", "#f9c80e"), ("Haldi Yellow", "#f0b800"), ("Turmeric", "#e0a31b"),
    ("Honey", "#e0a526"), ("Golden Yellow", "#ffc61a"), ("Dark Mustard", "#b8860b"), ("Corn", "#f5d547"),
    ("Banana", "#ffe135"), ("Straw", "#e4d96f"), ("Maize", "#f2c649"), ("Neon Yellow", "#e6ff00"),
    ("Antique Gold", "#a98307"), ("Old Gold", "#cfb53b"), ("Light Gold", "#e6c97a"), ("Brass", "#b5a642"),
    # Greens
    ("Lime", "#a4d233"), ("Lime Green", "#7ed321"), ("Neon Green", "#39ff14"), ("Parrot Green", "#5dbb2f"),
    ("Apple Green", "#8db600"), ("Light Green", "#90ee90"), ("Pastel Green", "#b5e5b0"), ("Mint", "#b2ecd0"),
    ("Mint Green", "#98ffcc"), ("Pista Green", "#a8d5a2"), ("Pistachio", "#93c572"), ("Sage", "#9caf88"),
    ("Sage Green", "#8a9a5b"), ("Moss Green", "#6b7f3a"), ("Fern", "#4f7942"), ("Leaf Green", "#3f9b3f"),
    ("Grass Green", "#4c9a2a"), ("Emerald", "#0b8a5b"), ("Emerald Green", "#046b3f"), ("Jade", "#00a86b"),
    ("Forest Green", "#1b4d2e"), ("Hunter Green", "#2f5233"), ("Dark Green", "#0b3d20"), ("Pine", "#01796f"),
    ("Army Green", "#4b5320"), ("Military Green", "#556b2f"), ("Khaki Green", "#78866b"), ("Olive Green", "#708238"),
    ("Dark Olive", "#3b4421"), ("Avocado", "#568203"), ("Seaweed", "#2f4a30"), ("Mehendi Green", "#7a8b2c"),
    ("Mehndi", "#6e7d2f"), ("Peacock Green", "#0b6e5a"), ("Bottle Green Dark", "#06402b"), ("Racing Green", "#0c3b2e"),
    ("Basil", "#3a5f3c"), ("Matcha", "#a3b86c"), ("Celadon", "#aacfa8"), ("Eucalyptus", "#6d8d7a"),
    ("Laurel", "#a9ba9d"), ("Shamrock", "#2dbd6e"), ("Kelly Green", "#32a64a"), ("Neon Lime", "#c6ff00"),
    # Teals, aquas
    ("Teal", "#008080"), ("Dark Teal", "#014d4e"), ("Teal Blue", "#367588"), ("Peacock Blue", "#0a7b8c"),
    ("Turquoise", "#30d5c8"), ("Aqua", "#7fdbda"), ("Aquamarine", "#7fffd4"), ("Sea Green", "#2e8b57"),
    ("Sea Foam", "#9fe2bf"), ("Cyan", "#00bcd4"), ("Lagoon", "#2aa7a1"), ("Spearmint", "#7ed6c3"),
    ("Petrol", "#005f6a"), ("Petrol Blue", "#1f5f73"), ("Ocean", "#2d7d8f"), ("Cerulean", "#2a7fba"),
    # Blues
    ("Baby Blue", "#bfdcf0"), ("Powder Blue", "#b0d4e8"), ("Ice Blue", "#d6eaf8"), ("Pastel Blue", "#aec6cf"),
    ("Light Blue", "#add8e6"), ("Cornflower Blue", "#6495ed"), ("Periwinkle", "#8f9fe0"), ("Denim Blue", "#3b6a9c"),
    ("Light Denim", "#8cb0d6"), ("Dark Denim", "#27415f"), ("Indigo", "#2e3a87"), ("Indigo Dye", "#26356b"),
    ("Royal Blue", "#1f4fd8"), ("Cobalt", "#0047ab"), ("Electric Blue", "#1e6fff"), ("Azure", "#1f8fe5"),
    ("Sapphire", "#0f3d8c"), ("Navy Blue", "#14213d"), ("Midnight Blue", "#101a3d"), ("Ink Blue", "#1c2b4a"),
    ("Prussian Blue", "#12304f"), ("Admiral Blue", "#1b2a49"), ("Steel Blue", "#4682b4"), ("Air Force Blue", "#5d8aa8"),
    ("Dusty Blue", "#7d9bb5"), ("Stone Blue", "#7a9eb0"), ("Slate Blue", "#6a7fa6"), ("Smoky Blue", "#6f8fa6"),
    ("Turkish Blue", "#1d7fa8"), ("Ferozi", "#2bb3c0"), ("Firozi", "#1fa9b5"), ("Capri Blue", "#00a8e8"),
    ("Neon Blue", "#1f51ff"), ("Teal Navy", "#183a50"), ("Regatta Blue", "#2f5d8a"), ("Marine Blue", "#14456b"),
    # Purples, violets
    ("Lavender", "#b9a4de"), ("Light Lavender", "#e1d6f2"), ("Lilac", "#c8a2c8"), ("Wisteria", "#a698c9"),
    ("Mauve", "#b08aa5"), ("Dusty Mauve", "#a07a8f"), ("Violet", "#7f3fbf"), ("Dark Violet", "#4b1d7a"),
    ("Amethyst", "#8e5db8"), ("Orchid", "#c26dbc"), ("Plum", "#5d2a52"), ("Dark Plum", "#3d1635"),
    ("Aubergine", "#3d1f3d"), ("Eggplant", "#4a2545"), ("Grape", "#6f2da8"), ("Royal Purple", "#4b2a8c"),
    ("Imperial Purple", "#5b1f6b"), ("Mulberry", "#8a2a63"), ("Berry", "#8f2a5a"), ("Boysenberry", "#6c2c5a"),
    ("Heather", "#a98bb0"), ("Thistle", "#d8bfd8"), ("Lavender Grey", "#b6b0c9"), ("Jamuni", "#5a2a6a"),
    ("Ultra Violet", "#5f4b8b"), ("Neon Purple", "#a020f0"), ("Pastel Purple", "#cdb4db"), ("Iris", "#5a4fcf"),
    # Metallics and specials
    ("Rose Gold Metallic", "#d4a190"), ("Champagne Gold", "#d9c08c"), ("Pale Gold", "#e6be8a"), ("Dull Gold", "#b3965a"),
    ("Gunmetal Grey", "#53585f"), ("Platinum", "#e5e4e2"), ("Chrome", "#d1d5d8"), ("Titanium", "#878681"),
    ("Antique Silver", "#aaa9ad"), ("Copper Rose", "#b57a6a"), ("Pearl White", "#f6f1e7"), ("Gold Metallic", "#d4af37"),
    ("Silver Metallic", "#c9c9cf"), ("Holographic", ""), ("Iridescent", ""), ("Transparent", ""),
    # Mixed / patterned (no single swatch)
    ("Printed", ""), ("Floral", ""), ("Striped", ""), ("Checked", ""), ("Polka Dot", ""),
    ("Tie-Dye", ""), ("Ombre", ""), ("Camouflage", ""), ("Animal Print", ""), ("Abstract", ""),
    ("Black & White", ""), ("Navy & White", ""), ("Red & Black", ""), ("Blue & White", ""), ("Assorted", ""),
]
