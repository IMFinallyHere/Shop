import { useEffect, useState } from 'react'
import { receiveDuePayment } from '../../api/billing'
import { getPaymentMethods } from '../../api/shopsettings'
import Modal from '../common/Modal'
import ErrorAlert from '../common/ErrorAlert'
import Button from '../ui/Button'
import { Field, Input } from '../ui/Field'
import SegmentedControl from '../ui/SegmentedControl'
import { useToast } from '../ui/Toast'
import { money } from '../../utils/format'

// Take a payment against what a customer owes. It is applied to their oldest unpaid bills first.
// `customer`: { customer_id, name, owed }.
export default function ReceiveDueModal({ isOpen, customer, ...rest }) {
  // Mounted only while open, so every opening starts from a fresh form.
  return isOpen && customer ? <ReceiveForm customer={customer} {...rest} /> : null
}

function ReceiveForm({ customer, onClose, onDone }) {
  const [methods, setMethods] = useState([])
  const [mode, setMode] = useState('')
  const [amount, setAmount] = useState(String(Number(customer.owed)))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    getPaymentMethods({ active: 1 }).then(r => {
      const list = r.data.results ?? r.data
      setMethods(list)
      setMode(list[0]?.name ?? '')
    }).catch(() => {})
  }, [])

  const owed = Number(customer.owed)
  const value = Number(amount)
  const valid = value > 0 && value <= owed + 0.001 && !!mode

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const { data } = await receiveDuePayment({ customer_id: customer.customer_id, amount: value.toFixed(2), payment_mode: mode, note })
      toast(`Received ${money(data.amount)} from ${customer.name}`)
      onDone?.(data)
    } catch (e) {
      const d = e.response?.data
      setError(d?.amount || d?.payment_mode || d?.detail || 'Could not save the payment.')
    } finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} title="Receive payment"
      description={`${customer.name} owes ${money(owed)}. Payments go to their oldest bills first.`}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={saving} disabled={!valid}>Receive {valid ? money(value) : ''}</Button>
      </>}>
      <div className="space-y-4">
        <ErrorAlert message={error} onDismiss={() => setError('')} />
        <Field label="Amount received" error={value > owed + 0.001 ? `More than they owe (${money(owed)}).` : undefined}>
          <div className="flex gap-2">
            <Input type="number" min="0" max={owed} step="0.01" autoFocus value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount received" className="flex-1" />
            <Button onClick={() => setAmount(String(owed))}>Full</Button>
          </div>
        </Field>
        <Field label="Paid via">
          <SegmentedControl stretch options={methods.map(m => ({ value: m.name, label: m.name }))} value={mode} onChange={setMode} />
        </Field>
        <Field label="Note">
          {id => <Input id={id} value={note} onChange={e => setNote(e.target.value)} maxLength={255} placeholder="Optional" />}
        </Field>
      </div>
    </Modal>
  )
}
