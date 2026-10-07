import PrintSheet from '../common/PrintSheet'
import { money } from '../../utils/format'

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .receipt-root, .receipt-root * { visibility: visible !important; }
  .receipt-root { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
}
`

export default function BillReceipt({ bill, onClose }) {
  if (!bill) return null
  return (
    <PrintSheet title={`Bill ${bill.number}`} css={PRINT_CSS} onClose={onClose}>
      <div className="receipt-root mx-auto my-8 max-w-sm rounded-xl bg-white p-6 text-sm text-gray-800 shadow-card print:my-0 print:shadow-none">
        <div className="text-center mb-4">
          <div className="text-lg font-bold">{bill.shop_name || 'Shop'}</div>
          <div className="text-gray-500">Tax Invoice</div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mb-3">
          <span>{bill.number}</span>
          <span>{new Date(bill.created_at).toLocaleString()}</span>
        </div>
        {bill.customer_name && (
          <div className="text-xs text-gray-600 mb-3">Customer: {bill.customer_name} {bill.customer_phone && `· ${bill.customer_phone}`}</div>
        )}
        <table className="w-full mb-3">
          <thead>
            <tr className="border-b border-gray-300 text-xs text-gray-500">
              <th className="text-left py-1">Item</th>
              <th className="text-right py-1">Price</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map(it => (
              <tr key={it.id} className="border-b border-gray-100">
                <td className="py-1">
                  <span className={it.returned ? 'line-through text-gray-400' : ''}>{it.product_name}</span>
                  {it.returned && <span className="ml-1 text-[10px] text-red-500">returned</span>}
                  <div className="text-[10px] text-gray-400 font-mono">{it.code}</div>
                </td>
                <td className={`py-1 text-right ${it.returned ? 'line-through text-gray-400' : ''}`}>{money(it.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 text-right">
          <Row label="Subtotal" value={money(bill.subtotal)} />
          {Number(bill.discount_amount) > 0 && <Row label={`Discount${bill.discount_type === 'percent' ? ` (${bill.discount_value}%)` : ''}`} value={`− ${money(bill.discount_amount)}`} />}
          {Number(bill.tax_amount) > 0 && <Row label={`Tax (${bill.tax_rate}%)`} value={money(bill.tax_amount)} />}
          <div className="flex justify-between border-t border-gray-300 pt-1 font-bold text-base"><span>Total</span><span>{money(bill.total)}</span></div>
          {Number(bill.credit_used) > 0 && (
            <>
              <Row label="Store credit" value={`− ${money(bill.credit_used)}`} />
              <Row label="Paid" value={money(Number(bill.total) - Number(bill.credit_used))} />
            </>
          )}
          <div className="text-xs text-gray-500 pt-1">Paid via {bill.payment_mode?.toUpperCase()}</div>
          {bill.returns?.map(r => (
            <div key={r.id} className="text-xs text-red-500">
              {r.number}: {money(r.amount)} {r.mode === 'credit' ? 'to store credit' : `refunded via ${r.payment_mode}`}
            </div>
          ))}
        </div>
        <div className="text-center text-xs text-gray-400 mt-6">Thank you!</div>
      </div>
    </PrintSheet>
  )
}

function Row({ label, value }) {
  return <div className="flex justify-between text-gray-600"><span>{label}</span><span>{value}</span></div>
}
