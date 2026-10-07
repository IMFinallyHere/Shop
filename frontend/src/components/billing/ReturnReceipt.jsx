import { createPortal } from 'react-dom'

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .receipt-root, .receipt-root * { visibility: visible !important; }
  .receipt-root { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
}
`

const money = (v) => `₹${Number(v).toFixed(2)}`

export default function ReturnReceipt({ ret, onClose }) {
  if (!ret) return null
  return createPortal(
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      <style>{PRINT_CSS}</style>
      <div className="no-print sticky top-0 bg-gray-50 border-b px-6 py-3 flex items-center justify-between">
        <div className="font-semibold text-gray-800">Return {ret.number}</div>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm">🖨 Print</button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm">Close</button>
        </div>
      </div>

      <div className="receipt-root mx-auto my-6 max-w-sm p-6 text-sm text-gray-800">
        <div className="text-center mb-4">
          <div className="text-lg font-bold">{ret.shop_name || 'Shop'}</div>
          <div className="text-gray-500">Credit Note</div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{ret.number}</span>
          <span>{new Date(ret.created_at).toLocaleString()}</span>
        </div>
        <div className="text-xs text-gray-500 mb-3">Against bill {ret.bill_number}</div>
        {ret.customer_name && (
          <div className="text-xs text-gray-600 mb-3">Customer: {ret.customer_name} {ret.customer_phone && `· ${ret.customer_phone}`}</div>
        )}
        <table className="w-full mb-3">
          <thead>
            <tr className="border-b border-gray-300 text-xs text-gray-500">
              <th className="text-left py-1">Item</th>
              <th className="text-right py-1">Refund</th>
            </tr>
          </thead>
          <tbody>
            {ret.items.map(it => (
              <tr key={it.id} className="border-b border-gray-100">
                <td className="py-1">{it.product_name}<div className="text-[10px] text-gray-400 font-mono">{it.code}</div></td>
                <td className="py-1 text-right">{money(it.refund_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between border-t border-gray-300 pt-1 font-bold text-base"><span>Total</span><span>{money(ret.amount)}</span></div>
        <div className="text-xs text-gray-500 pt-1 text-right">
          {ret.mode === 'credit' ? 'Added to store credit' : `Refunded via ${ret.payment_mode?.toUpperCase()}`}
        </div>
        {ret.reason && <div className="text-xs text-gray-500 mt-2">Reason: {ret.reason}</div>}
        <div className="text-center text-xs text-gray-400 mt-6">Thank you!</div>
      </div>
    </div>,
    document.body
  )
}
