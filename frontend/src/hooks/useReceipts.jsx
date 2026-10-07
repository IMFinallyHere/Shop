import { useState } from 'react'
import { getBill, getReturn } from '../api/billing'
import BillReceipt from '../components/billing/BillReceipt'
import ReturnReceipt from '../components/billing/ReturnReceipt'

// Open a bill or return receipt from anywhere: const { openBill, openReturn, receipts } = useReceipts()
// and render {receipts} once in the component.
export default function useReceipts(onError = () => {}) {
  const [bill, setBill] = useState(null)
  const [ret, setRet] = useState(null)
  const openBill = (id) => getBill(id).then(r => setBill(r.data)).catch(() => onError('Failed to load bill.'))
  const openReturn = (id) => getReturn(id).then(r => setRet(r.data)).catch(() => onError('Failed to load return.'))
  const receipts = <>
    <BillReceipt bill={bill} onClose={() => setBill(null)} />
    <ReturnReceipt ret={ret} onClose={() => setRet(null)} />
  </>
  return { openBill, openReturn, receipts }
}
