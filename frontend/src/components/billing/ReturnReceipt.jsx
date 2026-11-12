import ReceiptFrame from './ReceiptFrame'
import { formatReceiptDate, money } from '../../utils/format'
import { variantPart } from '../../utils/variant'
import usePrintSettings from '../../hooks/usePrintSettings'

export default function ReturnReceipt({ ret, onClose }) {
  const hideName = !!usePrintSettings().hide_product_name
  if (!ret) return null
  return (
    <ReceiptFrame title={`Return ${ret.number}`} docTitle="Credit Note" shopName={ret.shop_name} onClose={onClose}>
      <div className="mb-[0.2em] flex justify-between text-[0.85em] text-gray-500">
        <span>{ret.number}</span>
        <span>{formatReceiptDate(ret.created_at)}</span>
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
              <td className="py-[0.25em]">
                {hideName ? (
                  <>
                    <span className="font-mono">{it.code}</span>
                    <div className="text-[0.75em] text-gray-400">{variantPart(it.product_name)}</div>
                  </>
                ) : (
                  <>{it.product_name}<div className="font-mono text-[0.75em] text-gray-400">{it.code}</div></>
                )}
              </td>
              <td className="py-[0.25em] text-right align-top">{money(it.refund_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between border-t border-gray-400 pt-[0.2em] text-[1.15em] font-bold"><span>Total</span><span>{money(ret.amount)}</span></div>
      <div className="pt-[0.2em] text-right text-[0.85em] text-gray-500">
        {Number(ret.due_cleared) > 0 && <div>{money(ret.due_cleared)} adjusted against balance due</div>}
        {Number(ret.amount) - Number(ret.due_cleared) > 0 && (
          ret.mode === 'credit'
            ? `${money(Number(ret.amount) - Number(ret.due_cleared))} added to store credit`
            : `${money(Number(ret.amount) - Number(ret.due_cleared))} refunded via ${ret.payment_mode?.toUpperCase()}`
        )}
      </div>
      {ret.reason && <div className="mt-[0.5em] text-[0.85em] text-gray-500">Reason: {ret.reason}</div>}
    </ReceiptFrame>
  )
}
