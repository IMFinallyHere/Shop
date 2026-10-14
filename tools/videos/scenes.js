// The how-to videos. Each step is spoken (English by Rishi, Hindi by Lekha), shown as a
// caption, and acted out on the demo shop. A step stays on screen at least as long as
// its narration. Button names stay in English in the Hindi script: that's what's on screen.
//
// `d` is a Director (director.js); `data` comes from record.js (codes, phone, etc.).

module.exports = {
  'add-product': {
    steps: [
      {
        en: 'To add a new product, open Products and click New product.',
        hi: 'नया प्रोडक्ट जोड़ने के लिए, Products खोलें और New product पर क्लिक करें।',
        do: async (d) => { await d.goto('/products'); await d.click(d.page.getByRole('button', { name: 'New product' }).first()) },
      },
      {
        en: 'Type the product name, then pick its category and seller.',
        hi: 'प्रोडक्ट का नाम लिखें, फिर उसकी कैटेगरी और सप्लायर चुनें।',
        do: async (d) => {
          await d.type(d.page.getByLabel('Product name'), 'Linen Kurta Set')
          await d.select(d.page.getByLabel('Category'), 'Kurtis')
          await d.select(d.page.getByLabel('Seller'), 'Jaipur Textiles')
        },
      },
      {
        en: 'Click Create product.',
        hi: 'Create product पर क्लिक करें।',
        do: async (d) => { await d.click(d.page.getByRole('button', { name: 'Create product' })); await d.pause(600) },
      },
      {
        en: 'Now add its stock. Click Add stock on the new product.',
        hi: 'अब इसका स्टॉक जोड़ें। नए प्रोडक्ट के सामने Add stock पर क्लिक करें।',
        do: async (d) => {
          await d.type(d.page.getByPlaceholder('Search products…'), 'Linen Kurta')
          // Let the search settle so the click doesn't land on a row being replaced.
          await d.page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1)
          await d.pause(500)
          await d.click(d.page.getByRole('row', { name: /Linen Kurta Set/ }).getByRole('button', { name: 'Add stock' }))
          await d.page.getByRole('button', { name: 'Add line' }).waitFor()
        },
      },
      {
        en: 'Each line is one colour and size. Pick them, then enter how many pieces, the cost and the selling price.',
        hi: 'हर लाइन एक रंग और साइज़ है। उन्हें चुनें, फिर कितने पीस हैं, लागत और बिक्री की कीमत डालें।',
        do: async (d) => {
          const p = d.page
          await d.select(p.getByLabel('Color').nth(0), 'Olive')
          await d.select(p.getByLabel('Size').nth(0), 'M')
          await d.type(p.getByLabel('Quantity').nth(0), '4')
          await d.type(p.getByLabel('Cost price').nth(0), '650')
          await d.type(p.getByLabel('Selling price').nth(0), '1199')
        },
      },
      {
        en: 'Click Add line for another size.',
        hi: 'दूसरे साइज़ के लिए Add line पर क्लिक करें।',
        do: async (d) => {
          const p = d.page
          await d.click(p.getByRole('button', { name: 'Add line' }))
          await d.select(p.getByLabel('Color').nth(1), 'Olive')
          await d.select(p.getByLabel('Size').nth(1), 'L')
          await d.type(p.getByLabel('Quantity').nth(1), '3')
          await d.type(p.getByLabel('Cost price').nth(1), '650')
          await d.type(p.getByLabel('Selling price').nth(1), '1199')
        },
      },
      {
        en: 'Click Add and print. Every piece gets its own barcode.',
        hi: 'Add and print पर क्लिक करें। हर पीस को अपना बारकोड मिलता है।',
        do: async (d) => { await d.click(d.page.getByRole('button', { name: /Add 7 units/ })); await d.pause(1200) },
      },
      {
        en: 'The tags are ready. Print them now on your label printer, or close and print later from Stock.',
        hi: 'टैग तैयार हैं। इन्हें अभी लेबल प्रिंटर पर प्रिंट करें, या बंद करके बाद में Stock से प्रिंट करें।',
        do: async (d) => { await d.point(d.page.getByRole('button', { name: 'Print', exact: true })) },
      },
    ],
  },

  'print-tags': {
    steps: [
      {
        en: 'First, set your label size. Open Settings, then Printing, and pick the size of your sticker roll.',
        hi: 'सबसे पहले लेबल का साइज़ सेट करें। Settings में Printing खोलें, और अपने स्टिकर रोल का साइज़ चुनें।',
        do: async (d) => { await d.goto('/settings?tab=printing'); await d.click(d.page.getByRole('button', { name: '38 × 25 mm' })) },
      },
      {
        en: 'Choose what shows on the tag. The preview is the real size. Then save.',
        hi: 'चुनें कि टैग पर क्या दिखे। प्रीव्यू असली साइज़ का है। फिर सेव करें।',
        do: async (d) => {
          await d.point(d.page.getByText('Actual size preview'))
          await d.click(d.page.getByRole('button', { name: 'Save print settings' }))
        },
      },
      {
        en: 'To print tags for stock you already have, open Stock and search for the product.',
        hi: 'जो स्टॉक पहले से है उसके टैग प्रिंट करने के लिए, Stock खोलें और प्रोडक्ट खोजें।',
        do: async (d) => {
          await d.click(d.page.getByRole('link', { name: 'Stock', exact: true }))
          await d.pause(500)
          await d.type(d.page.getByPlaceholder('Search code, product, color, size…'), 'Chikankari')
          await d.pause(900)
        },
      },
      {
        en: 'Click Print labels on this page. You get one tag for every piece listed.',
        hi: 'Print labels on this page पर क्लिक करें। सूची के हर पीस का एक टैग बनेगा।',
        do: async (d) => { await d.click(d.page.getByRole('button', { name: 'Print labels on this page' })); await d.pause(900) },
      },
      {
        en: 'Click Print and choose your label printer. Each tag prints on its own sticker.',
        hi: 'Print पर क्लिक करें और अपना लेबल प्रिंटर चुनें। हर टैग अपने स्टिकर पर प्रिंट होता है।',
        do: async (d) => { await d.point(d.page.getByRole('button', { name: 'Print', exact: true })) },
      },
    ],
  },

  'make-bill': {
    steps: [
      {
        en: 'Open New bill. The scan box is ready straight away.',
        hi: 'New bill खोलें। स्कैन बॉक्स तुरंत तैयार रहता है।',
        do: async (d) => { await d.goto('/dashboard'); await d.click(d.page.getByRole('link', { name: 'New bill' }).last()); await d.pause(500) },
      },
      {
        en: 'Scan a tag with your barcode scanner, or type its code and press Enter.',
        hi: 'बारकोड स्कैनर से टैग स्कैन करें, या उसका कोड लिखकर Enter दबाएं।',
        do: async (d, data) => {
          await d.type(d.page.getByPlaceholder('Scan or type a barcode, then Enter'), data.codes[0], { delay: 45 })
          await d.press('Enter')
        },
      },
      {
        en: 'Scan the next piece. Each one is added to the bill.',
        hi: 'अगला पीस स्कैन करें। हर पीस बिल में जुड़ता जाता है।',
        do: async (d, data) => {
          await d.type(d.page.getByPlaceholder('Scan or type a barcode, then Enter'), data.codes[1], { delay: 45 })
          await d.press('Enter')
        },
      },
      {
        en: 'Type the customer’s phone number. A returning customer’s name fills in by itself.',
        hi: 'ग्राहक का फ़ोन नंबर लिखें। पुराने ग्राहक का नाम अपने आप भर जाता है।',
        do: async (d, data) => {
          await d.type(d.page.getByLabel('Customer phone'), data.phone)
          await d.page.getByLabel('Customer phone').blur()
          await d.pause(900)
        },
      },
      {
        en: 'Choose how they pay, for example U P I.',
        hi: 'भुगतान का तरीका चुनें, जैसे U P I.',
        do: async (d) => { await d.click(d.page.getByRole('radio', { name: 'UPI' })) },
      },
      {
        en: 'Click Charge. The bill is saved, and the stock goes down by itself.',
        hi: 'Charge पर क्लिक करें। बिल सेव हो जाता है, और स्टॉक अपने आप कम हो जाता है।',
        do: async (d) => { await d.click(d.page.getByRole('button', { name: /^Charge/ })); await d.pause(1200) },
      },
      {
        en: 'The receipt opens, ready to print.',
        hi: 'रसीद खुल जाती है, प्रिंट के लिए तैयार।',
        do: async (d) => { await d.point(d.page.getByRole('button', { name: 'Print', exact: true })) },
      },
    ],
  },

  returns: {
    steps: [
      {
        en: 'Open Returns, then scan the barcode of the piece that came back.',
        hi: 'Returns खोलें, फिर वापस आए पीस का बारकोड स्कैन करें।',
        do: async (d, data) => {
          await d.goto('/returns')
          await d.type(d.page.getByLabel('Barcode or bill number'), data.soldCode, { delay: 45 })
          await d.press('Enter')
          await d.pause(900)
        },
      },
      {
        en: 'The bill it was sold on opens, with that piece ticked.',
        hi: 'जिस बिल पर यह बिका था वह खुल जाता है, और वह पीस चुना हुआ होता है।',
        do: async (d) => {
          const box = d.page.locator('input[type="checkbox"]:checked').first()
          await d.point(box.locator('xpath=..'))
        },
      },
      {
        en: 'Choose Refund to give the money back, or Store credit for the customer to spend next time.',
        hi: 'पैसे लौटाने के लिए Refund चुनें, या Store credit ताकि ग्राहक अगली बार खरीदारी में इस्तेमाल करे।',
        do: async (d) => { await d.click(d.page.getByRole('radio', { name: 'Store credit' })) },
      },
      {
        en: 'Add a reason if you like, then confirm.',
        hi: 'चाहें तो कारण लिखें, फिर पुष्टि करें।',
        do: async (d) => {
          await d.type(d.page.getByPlaceholder("Optional — e.g. size didn't fit"), 'Size did not fit')
          await d.click(d.page.locator('button.w-full', { hasText: /return|credit|refund/i }).last())
          await d.pause(1200)
        },
      },
      {
        en: 'The credit note opens. The piece is back in stock, and the credit is saved on the customer.',
        hi: 'क्रेडिट नोट खुल जाता है। पीस वापस स्टॉक में आ गया, और क्रेडिट ग्राहक के खाते में सेव हो गया।',
        do: async (d) => { await d.pause(400) },
      },
    ],
  },

  'setup-shop': {
    steps: [
      {
        en: 'Open Settings. On Billing and tax, enter your G S T rate and save.',
        hi: 'Settings खोलें। Billing and tax में अपना G S T रेट डालें और सेव करें।',
        do: async (d) => {
          await d.goto('/settings')
          await d.type(d.page.getByLabel('Tax rate'), '5')
          await d.click(d.page.getByRole('button', { name: 'Save' }))
        },
      },
      {
        en: 'Next, open Printing to add your receipt details.',
        hi: 'अब रसीद की जानकारी डालने के लिए Printing खोलें।',
        do: async (d) => { await d.click(d.page.getByRole('tab', { name: 'Printing' }).or(d.page.getByRole('button', { name: 'Printing' }))) },
      },
      {
        en: 'Enter your address, phone number and G S T I N. They print at the top of every receipt.',
        hi: 'अपना पता, फ़ोन नंबर और G S T I N डालें। ये हर रसीद के ऊपर छपते हैं।',
        do: async (d) => {
          const p = d.page
          await d.type(p.getByLabel('Address'), '22 MG Road, Jaipur 302001', { delay: 40 })
          await d.type(p.getByLabel('Phone'), '+91 94140 22581', { delay: 40 })
          await d.type(p.getByLabel('GSTIN'), '08AABCK1234F1Z9', { delay: 40 })
        },
      },
      {
        en: 'Pick your receipt paper width, then save.',
        hi: 'रसीद के कागज़ की चौड़ाई चुनें, फिर सेव करें।',
        do: async (d) => {
          await d.click(d.page.getByRole('radio', { name: '80 mm' }))
          await d.click(d.page.getByRole('button', { name: 'Save print settings' }))
        },
      },
      {
        en: 'Print a test receipt to check how it looks.',
        hi: 'देखने के लिए एक टेस्ट रसीद प्रिंट करें।',
        do: async (d) => { await d.click(d.page.getByRole('button', { name: 'Print test receipt' })); await d.pause(900) },
      },
    ],
  },

  'add-staff': {
    steps: [
      {
        en: 'Open Users, then click Add user.',
        hi: 'Users खोलें, फिर Add user पर क्लिक करें।',
        do: async (d) => { await d.goto('/users'); await d.click(d.page.getByRole('button', { name: 'Add user' }).first()) },
      },
      {
        en: 'Enter their email, name and a password, and tick Staff so they can sign in.',
        hi: 'उनका ईमेल, नाम और पासवर्ड डालें, और Staff पर टिक करें ताकि वे साइन इन कर सकें।',
        do: async (d, data) => {
          const p = d.page
          await d.type(p.getByLabel('Email'), data.staffEmail, { delay: 45 })
          await d.type(p.getByLabel('First name'), 'Neha')
          await d.type(p.getByLabel('Password'), 'Counter#2026', { delay: 45 })
          await d.click(p.getByRole('checkbox', { name: /Staff/ }))
        },
      },
      {
        en: 'Click Add user. Now give them a role.',
        hi: 'Add user पर क्लिक करें। अब उन्हें एक रोल दें।',
        do: async (d) => { await d.click(d.page.getByRole('button', { name: 'Add user' }).last()); await d.pause(900) },
      },
      {
        en: 'Open the menu next to their name, and choose Assign groups.',
        hi: 'उनके नाम के आगे वाला मेन्यू खोलें, और Assign groups चुनें।',
        do: async (d, data) => {
          await d.click(d.page.getByRole('row', { name: new RegExp(data.staffEmail.replace('.', '\\.')) }).getByRole('button', { name: 'Actions' }))
          await d.click(d.page.getByText('Assign groups'))
        },
      },
      {
        en: 'Tick Cashier and save. Cashiers can make bills and returns, but can’t change stock or settings.',
        hi: 'Cashier पर टिक करें और सेव करें। कैशियर बिल और वापसी कर सकते हैं, पर स्टॉक या सेटिंग नहीं बदल सकते।',
        do: async (d) => {
          await d.click(d.page.getByRole('checkbox', { name: 'Cashier' }))
          await d.click(d.page.getByRole('button', { name: 'Save', exact: true }))
          await d.pause(700)
        },
      },
      {
        en: 'Done. They can now sign in to your shop with their email and password.',
        hi: 'हो गया। अब वे अपने ईमेल और पासवर्ड से आपकी दुकान में साइन इन कर सकते हैं।',
        do: async (d) => { await d.pause(300) },
      },
    ],
  },
}
