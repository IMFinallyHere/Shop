// Text for the first-run tour, setup checklist and help videos, in English and Hindi.
// The app's own screens stay in English. Hindi needs a review by a fluent speaker
// before launch; keep both dictionaries' keys identical.

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी' },
]

export const STRINGS = {
  en: {
    'tour.next': 'Next',
    'tour.back': 'Back',
    'tour.done': 'Done',
    'tour.progress': '{{current}} of {{total}}',
    'tour.welcome.title': 'Welcome to {shop}',
    'tour.welcome.body': 'A quick look around. It takes under a minute. You can switch language any time from your name at the top right.',
    'tour.welcomeStaff.body': 'A quick look at the parts of the shop you’ll use. It takes under a minute.',
    'tour.sell.title': 'Selling',
    'tour.sell.body': 'New bills, past sales, returns and customers are all here.',
    'tour.inventory.title': 'Your stock',
    'tour.inventory.body': 'Add products, see every piece in stock, and keep categories and sellers in order.',
    'tour.newBill.title': 'Make a bill',
    'tour.newBill.body': 'Opens the billing counter. Scan a tag or type its code, pick how the customer pays, and charge.',
    'tour.search.title': 'Find anything',
    'tour.search.body': 'Scan or type a barcode, bill number, customer name or product.',
    'tour.admin.title': 'Set up your shop',
    'tour.admin.body': 'Tax, receipt details, label and receipt printers, and your staff and what they can do.',
    'tour.help.title': 'Help is here',
    'tour.help.body': 'Watch the how-to videos, take this tour again or switch between English and Hindi.',
    'tour.checklist.title': 'Your first steps',
    'tour.checklist.body': 'Five things to get the shop ready. Each one ticks itself off when you do it.',

    'checklist.title': 'Get your shop ready',
    'checklist.progress': '{done} of {total} done',
    'checklist.doIt': 'Do it',
    'checklist.watch': 'Watch how',
    'checklist.hide': 'Hide',
    'checklist.allDone': 'Your shop is ready. Happy selling!',
    'checklist.shop_details': 'Add your tax rate and receipt details',
    'checklist.first_product': 'Add your first product',
    'checklist.first_label': 'Print a tag',
    'checklist.first_bill': 'Make your first bill',
    'checklist.first_staff': 'Add a staff member',

    'menu.help': 'Help and videos',
    'menu.tour': 'Take the tour again',
    'menu.language': 'Language',

    'help.title': 'Help and videos',
    'help.subtitle': 'Short videos that show each job step by step, using a demo shop.',
    'help.minutes': '{n} min',
    'help.seconds': '{n} sec',
    'help.empty': 'The videos aren’t available yet.',
    'help.tour': 'Take the tour again',

    'video.add-product.title': 'Add a product and its stock',
    'video.add-product.body': 'Sizes, colours, price and how many of each.',
    'video.print-tags.title': 'Print tags',
    'video.print-tags.body': 'A barcode sticker for every piece.',
    'video.make-bill.title': 'Make a bill',
    'video.make-bill.body': 'Scan, find a returning customer, take UPI and print the receipt.',
    'video.returns.title': 'Take a return',
    'video.returns.body': 'Refund the money or give store credit.',
    'video.setup-shop.title': 'Set up tax and receipts',
    'video.setup-shop.body': 'Your tax rate, address, GSTIN and printer sizes.',
    'video.add-staff.title': 'Add a staff member',
    'video.add-staff.body': 'Give them a login and the Cashier role.',
  },

  hi: {
    'tour.next': 'आगे',
    'tour.back': 'पीछे',
    'tour.done': 'हो गया',
    'tour.progress': '{{total}} में से {{current}}',
    'tour.welcome.title': '{shop} में आपका स्वागत है',
    'tour.welcome.body': 'एक छोटा सा परिचय, एक मिनट से भी कम का। भाषा कभी भी ऊपर दाईं ओर अपने नाम पर क्लिक करके बदल सकते हैं।',
    'tour.welcomeStaff.body': 'दुकान के उन हिस्सों का छोटा सा परिचय जो आप इस्तेमाल करेंगे। एक मिनट से भी कम का।',
    'tour.sell.title': 'बिक्री',
    'tour.sell.body': 'नया बिल, पिछली बिक्री, वापसी और ग्राहक, सब यहीं हैं।',
    'tour.inventory.title': 'आपका स्टॉक',
    'tour.inventory.body': 'प्रोडक्ट जोड़ें, स्टॉक का हर पीस देखें, और कैटेगरी व सप्लायर संभालें।',
    'tour.newBill.title': 'बिल बनाएं',
    'tour.newBill.body': 'बिलिंग काउंटर खोलता है। टैग स्कैन करें या उसका कोड लिखें, भुगतान का तरीका चुनें और बिल बनाएं।',
    'tour.search.title': 'कुछ भी खोजें',
    'tour.search.body': 'बारकोड, बिल नंबर, ग्राहक का नाम या प्रोडक्ट स्कैन करें या लिखें।',
    'tour.admin.title': 'दुकान की सेटिंग',
    'tour.admin.body': 'टैक्स, रसीद की जानकारी, लेबल और रसीद प्रिंटर, और आपका स्टाफ व उनकी अनुमतियां।',
    'tour.help.title': 'मदद यहां है',
    'tour.help.body': 'कैसे करें वाले वीडियो देखें, यह परिचय दोबारा देखें या हिंदी और अंग्रेज़ी में बदलें।',
    'tour.checklist.title': 'आपके पहले कदम',
    'tour.checklist.body': 'दुकान तैयार करने के पांच काम। हर काम करते ही उस पर अपने आप सही का निशान लग जाता है।',

    'checklist.title': 'अपनी दुकान तैयार करें',
    'checklist.progress': '{total} में से {done} पूरे',
    'checklist.doIt': 'अभी करें',
    'checklist.watch': 'देखें कैसे',
    'checklist.hide': 'छिपाएं',
    'checklist.allDone': 'आपकी दुकान तैयार है। अच्छी बिक्री हो!',
    'checklist.shop_details': 'टैक्स रेट और रसीद की जानकारी डालें',
    'checklist.first_product': 'अपना पहला प्रोडक्ट जोड़ें',
    'checklist.first_label': 'एक टैग प्रिंट करें',
    'checklist.first_bill': 'अपना पहला बिल बनाएं',
    'checklist.first_staff': 'एक स्टाफ सदस्य जोड़ें',

    'menu.help': 'मदद और वीडियो',
    'menu.tour': 'परिचय दोबारा देखें',
    'menu.language': 'भाषा',

    'help.title': 'मदद और वीडियो',
    'help.subtitle': 'छोटे वीडियो जो एक डेमो दुकान पर हर काम कदम-दर-कदम दिखाते हैं।',
    'help.minutes': '{n} मिनट',
    'help.seconds': '{n} सेकंड',
    'help.empty': 'वीडियो अभी उपलब्ध नहीं हैं।',
    'help.tour': 'परिचय दोबारा देखें',

    'video.add-product.title': 'प्रोडक्ट और उसका स्टॉक जोड़ें',
    'video.add-product.body': 'साइज़, रंग, कीमत और हर एक की गिनती।',
    'video.print-tags.title': 'टैग प्रिंट करें',
    'video.print-tags.body': 'हर पीस के लिए एक बारकोड स्टिकर।',
    'video.make-bill.title': 'बिल बनाएं',
    'video.make-bill.body': 'स्कैन करें, पुराने ग्राहक को ढूंढें, UPI से भुगतान लें और रसीद प्रिंट करें।',
    'video.returns.title': 'सामान वापसी',
    'video.returns.body': 'पैसे लौटाएं या स्टोर क्रेडिट दें।',
    'video.setup-shop.title': 'टैक्स और रसीद सेट करें',
    'video.setup-shop.body': 'आपका टैक्स रेट, पता, GSTIN और प्रिंटर का साइज़।',
    'video.add-staff.title': 'स्टाफ सदस्य जोड़ें',
    'video.add-staff.body': 'उन्हें लॉगिन और कैशियर का रोल दें।',
  },
}

// Videos in the order the Help page lists them; `perm` hides ones the user can't act on.
export const VIDEOS = [
  { id: 'setup-shop', perm: 'shopsettings.change_shopsettings' },
  { id: 'add-product', perm: 'inventory.add_product' },
  { id: 'print-tags', perm: 'inventory.view_stockitem' },
  { id: 'make-bill', perm: 'billing.add_bill' },
  { id: 'returns', perm: 'billing.add_return' },
  { id: 'add-staff', perm: 'owner' },
]

// Which video explains each checklist step, and where "Do it" goes.
export const CHECKLIST = {
  shop_details: { video: 'setup-shop', to: '/settings' },
  first_product: { video: 'add-product', to: '/products' },
  first_label: { video: 'print-tags', to: '/settings?tab=printing' },
  first_bill: { video: 'make-bill', to: '/pos' },
  first_staff: { video: 'add-staff', to: '/users' },
}

// `{name}` placeholders; driver.js fills its own `{{current}}`/`{{total}}`.
export function translate(lang, key, vars = {}) {
  const text = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key
  return text.replace(/(?<!\{)\{(\w+)\}(?!\})/g, (_, k) => (k in vars ? vars[k] : `{${k}}`))
}
