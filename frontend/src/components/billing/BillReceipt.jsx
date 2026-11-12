import ReceiptFrame from './ReceiptFrame'
import { formatReceiptDate, money } from '../../utils/format'
import { variantPart } from '../../utils/variant'
import usePrintSettings from '../../hooks/usePrintSettings'

const pct = (rate) => `${Number(rate)}%`

export default function BillReceipt({ bill, autoPrint = false, onClose }) {
  const hideName = !!usePrintSettings().hide_product_name  // shops that hide names print only our code
  if (!bill) return null
  // Bills since per-piece GST carry a summary by rate; older ones show one tax line.
  const summary = bill.gst_summary ?? []
  const perLine = summary.length > 0
  const gst = summary.filter(r => Number(r.tax) > 0)
  const cgst = gst.reduce((s, r) => s + Number(r.cgst), 0)
  const sgst = gst.reduce((s, r) => s + Number(r.sgst), 0)
  return (
    <ReceiptFrame title={`Bill ${bill.number}`} docTitle="Tax Invoice" shopName={bill.shop_name} autoPrint={autoPrint} barcodeValue={bill.number} onClose={onClose}>
      <div className="mb-[0.8em] flex justify-between text-[0.85em] text-gray-500">
        <span>{bill.number}</span>
        <span>{formatReceiptDate(bill.created_at)}</span>
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
                {hideName ? (
                  <span className={`font-mono ${it.returned ? 'text-gray-400 line-through' : ''}`}>{it.code}</span>
                ) : (
                  <span className={it.returned ? 'text-gray-400 line-through' : ''}>{it.product_name}</span>
                )}
                {it.returned && <span className="ml-1 text-[0.75em] text-red-500">returned</span>}
                <div className="text-[0.75em] text-gray-400">
                  {hideName ? <span>{variantPart(it.product_name)}</span> : <span className="font-mono">{it.code}</span>}
                  {perLine && gst.length > 0 && it.tax_rate != null && <span> · GST {pct(it.tax_rate)}</span>}
                </div>
              </td>
              <td className={`py-[0.25em] text-right align-top ${it.returned ? 'text-gray-400 line-through' : ''}`}>{money(it.unit_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-[0.2em] border-t border-dashed border-gray-400 pt-[0.4em] text-right">
        <Row label="Subtotal" value={money(bill.subtotal)} />
        {Number(bill.discount_amount) > 0 && <Row label={`Discount${bill.discount_type === 'percent' ? ` (${Number(bill.discount_value)}%)` : ''}`} value={`− ${money(bill.discount_amount)}`} />}
        {!perLine && Number(bill.tax_amount) > 0 && <Row label={`Tax (${bill.tax_rate}%)`} value={money(bill.tax_amount)} />}
        {perLine && !bill.prices_include_tax && gst.length > 0 && (
          <>
            <Row label="CGST" value={money(cgst)} />
            <Row label="SGST" value={money(sgst)} />
          </>
        )}
        <div className="flex justify-between border-t border-gray-400 pt-[0.2em] text-[1.15em] font-bold">
          <span>{perLine && bill.prices_include_tax && gst.length > 0 ? 'Total (incl. GST)' : 'Total'}</span>
          <span>{money(bill.total)}</span>
        </div>
        {Number(bill.credit_used) > 0 && <Row label="Store credit" value={`− ${money(bill.credit_used)}`} />}
        {/* Sold partly on credit: what was paid at the counter, and what is still owed. */}
        {Number(bill.total) - Number(bill.credit_used) - Number(bill.amount_paid) > 0.005 ? (
          <>
            <Row label="Paid now" value={money(bill.amount_paid)} />
            {Number(bill.balance_due) > 0
              ? <div className="flex justify-between font-bold"><span>Balance due</span><span>{money(bill.balance_due)}</span></div>
              : <Row label="Balance" value="Settled" />}
          </>
        ) : Number(bill.credit_used) > 0 && <Row label="Paid" value={money(bill.amount_paid)} />}
        {Number(bill.amount_paid) > 0 && (
          <div className="pt-[0.2em] text-[0.85em] text-gray-500">Paid via {bill.payment_mode?.toUpperCase()}</div>
        )}
        {bill.returns?.map(r => (
          <div key={r.id} className="text-[0.85em] text-red-500">
            {r.number}: {money(r.amount)}{Number(r.due_cleared) > 0 && ` (${money(r.due_cleared)} off balance due)`}{' '}
            {Number(r.amount) - Number(r.due_cleared) > 0 && (r.mode === 'credit' ? 'to store credit' : `refunded via ${r.payment_mode}`)}
          </div>
        ))}
      </div>
      {gst.length > 0 && <GstSummary rows={gst} />}
    </ReceiptFrame>
  )
}

// Taxable value and CGST/SGST per rate (counter sales are intra-state: half each).
function GstSummary({ rows }) {
  const sum = (k) => rows.reduce((s, r) => s + Number(r[k]), 0)
  const cell = 'py-[0.1em] text-right tabular-nums'
  return (
    <table className="mt-[1em] w-full border-t border-dashed border-gray-400 text-[0.8em] text-gray-600">
      <thead>
        <tr className="text-gray-500">
          <th className="pt-[0.4em] text-left font-semibold">GST</th>
          <th className={`pt-[0.4em] font-semibold ${cell}`}>Taxable</th>
          <th className={`pt-[0.4em] font-semibold ${cell}`}>CGST</th>
          <th className={`pt-[0.4em] font-semibold ${cell}`}>SGST</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.rate}>
            <td className="py-[0.1em]">{pct(r.rate)}</td>
            <td className={cell}>{money(r.taxable)}</td>
            <td className={cell}>{money(r.cgst)}</td>
            <td className={cell}>{money(r.sgst)}</td>
          </tr>
        ))}
        {rows.length > 1 && (
          <tr className="border-t border-gray-300 font-semibold">
            <td className="py-[0.1em]">Total</td>
            <td className={cell}>{money(sum('taxable'))}</td>
            <td className={cell}>{money(sum('cgst'))}</td>
            <td className={cell}>{money(sum('sgst'))}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

function Row({ label, value }) {
  return <div className="flex justify-between text-gray-600"><span>{label}</span><span>{value}</span></div>
}
