import ReceiptFrame from './ReceiptFrame'
import { money } from '../../utils/format'

export default function ReturnReceipt({ ret, onClose }) {
  if (!ret) return null
  return (
    <ReceiptFrame title={`Return ${ret.number}`} docTitle="Credit Note" shopName={ret.shop_name} onClose={onClose}>
      <div className="mb-[0.2em] flex justify-between text-[0.85em] text-gray-500">
        <span>{ret.number}</span>
        <span>{new Date(ret.created_at).toLocaleString()}</span>
      </div>
      <div className="mb-[0.8em] text-[0.85em] text-gray-500">Against bill {ret.bill_number}</div>
      {ret.customer_name && (
        <div className="mb-[0.8em] text-[0.85em] text-gray-600">Customer: {ret.customer_name} {ret.customer_phone && `· ${ret.customer_phone}`}</div>
      )}
      <table className="mb-[0.8em] w-full">
        <thead>
          <tr className="border-b border-dashed border-gray-400 text-[0.85em] text-gray-500">
            <th className="py-[0.25em] text-left">Item</th>
            <th className="py-[0.25em] text-right">Refund</th>
          </tr>
        </thead>
        <tbody>
          {ret.items.map(it => (
            <tr key={it.id}>
              <td className="py-[0.25em]">{it.product_name}<div className="font-mono text-[0.75em] text-gray-400">{it.code}</div></td>
              <td className="py-[0.25em] text-right align-top">{money(it.refund_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between border-t border-gray-400 pt-[0.2em] text-[1.15em] font-bold"><span>Total</span><span>{money(ret.amount)}</span></div>
      <div className="pt-[0.2em] text-right text-[0.85em] text-gray-500">
        {ret.mode === 'credit' ? 'Added to store credit' : `Refunded via ${ret.payment_mode?.toUpperCase()}`}
      </div>
      {ret.reason && <div className="mt-[0.5em] text-[0.85em] text-gray-500">Reason: {ret.reason}</div>}
    </ReceiptFrame>
  )
}
