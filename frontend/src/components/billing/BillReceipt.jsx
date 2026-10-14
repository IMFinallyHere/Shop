import ReceiptFrame from './ReceiptFrame'
import { money } from '../../utils/format'

export default function BillReceipt({ bill, autoPrint = false, onClose }) {
  if (!bill) return null
  return (
    <ReceiptFrame title={`Bill ${bill.number}`} docTitle="Tax Invoice" shopName={bill.shop_name} autoPrint={autoPrint} onClose={onClose}>
      <div className="mb-[0.8em] flex justify-between text-[0.85em] text-gray-500">
        <span>{bill.number}</span>
        <span>{new Date(bill.created_at).toLocaleString()}</span>
      </div>
      {bill.customer_name && (
        <div className="mb-[0.8em] text-[0.85em] text-gray-600">Customer: {bill.customer_name} {bill.customer_phone && `· ${bill.customer_phone}`}</div>
      )}
      <table className="mb-[0.8em] w-full">
        <thead>
          <tr className="border-b border-dashed border-gray-400 text-[0.85em] text-gray-500">
            <th className="py-[0.25em] text-left">Item</th>
            <th className="py-[0.25em] text-right">Price</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map(it => (
            <tr key={it.id}>
              <td className="py-[0.25em]">
                <span className={it.returned ? 'text-gray-400 line-through' : ''}>{it.product_name}</span>
                {it.returned && <span className="ml-1 text-[0.75em] text-red-500">returned</span>}
                <div className="font-mono text-[0.75em] text-gray-400">{it.code}</div>
              </td>
              <td className={`py-[0.25em] text-right align-top ${it.returned ? 'text-gray-400 line-through' : ''}`}>{money(it.unit_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-[0.2em] border-t border-dashed border-gray-400 pt-[0.4em] text-right">
        <Row label="Subtotal" value={money(bill.subtotal)} />
        {Number(bill.discount_amount) > 0 && <Row label={`Discount${bill.discount_type === 'percent' ? ` (${bill.discount_value}%)` : ''}`} value={`− ${money(bill.discount_amount)}`} />}
        {Number(bill.tax_amount) > 0 && <Row label={`Tax (${bill.tax_rate}%)`} value={money(bill.tax_amount)} />}
        <div className="flex justify-between border-t border-gray-400 pt-[0.2em] text-[1.15em] font-bold"><span>Total</span><span>{money(bill.total)}</span></div>
        {Number(bill.credit_used) > 0 && (
          <>
            <Row label="Store credit" value={`− ${money(bill.credit_used)}`} />
            <Row label="Paid" value={money(Number(bill.total) - Number(bill.credit_used))} />
          </>
        )}
        <div className="pt-[0.2em] text-[0.85em] text-gray-500">Paid via {bill.payment_mode?.toUpperCase()}</div>
        {bill.returns?.map(r => (
          <div key={r.id} className="text-[0.85em] text-red-500">
            {r.number}: {money(r.amount)} {r.mode === 'credit' ? 'to store credit' : `refunded via ${r.payment_mode}`}
          </div>
        ))}
      </div>
    </ReceiptFrame>
  )
}

function Row({ label, value }) {
  return <div className="flex justify-between text-gray-600"><span>{label}</span><span>{value}</span></div>
}
