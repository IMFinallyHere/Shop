import { useState } from 'react'
import { addStoreCredit } from '../../api/billing'
import Modal from '../common/Modal'
import ErrorAlert from '../common/ErrorAlert'
import Button from '../ui/Button'
import { Field, Input } from '../ui/Field'
import { useToast } from '../ui/Toast'
import { money } from '../../utils/format'

// Give a customer store credit on purpose (an advance, goodwill, a voucher). They spend it at the
// counter like credit from a return. `customer`: { name, phone } when it is for a known customer;
// without it the form asks for the phone (and a name, for someone the shop hasn't met yet).
export default function AddCreditModal({ isOpen, ...rest }) {
  // Mounted only while open, so every opening starts from a fresh form.
  return isOpen ? <AddCreditForm {...rest} /> : null
}

function AddCreditForm({ customer, onClose, onDone }) {
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [name, setName] = useState(customer?.name ?? '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const value = Number(amount)
  const valid = /^\d{10}$/.test(phone) && value > 0

  const submit = async () => {
    setSaving(true); setErrors({})
    try {
      const { data } = await addStoreCredit({ phone, name: customer ? '' : name, amount: value.toFixed(2), note })
      toast(`Added ${money(data.amount)} store credit · balance ${money(data.balance)}`)
      onDone?.(data)
    } catch (e) {
      const d = e.response?.data ?? {}
      setErrors({ ...d, form: d.detail || (e.response?.status === 403 ? 'You are not allowed to add store credit.' : !e.response || e.response.status >= 500 ? 'Could not save the credit.' : '') })
    } finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} title="Add store credit"
      description={customer ? `${customer.name} can spend it on their next bill.` : 'The customer can spend it on their next bill.'}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} loading={saving} disabled={!valid}>Add {value > 0 ? money(value) : 'credit'}</Button>
      </>}>
      <div className="space-y-4">
        <ErrorAlert message={errors.form} onDismiss={() => setErrors(x => ({ ...x, form: '' }))} />
        {!customer && (<>
          <Field label="Customer phone" error={errors.phone}>
            {id => <Input id={id} inputMode="numeric" autoFocus value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10 digits" />}
          </Field>
          <Field label="Name" hint="Needed only if this customer is new to the shop." error={errors.name}>
            {id => <Input id={id} value={name} maxLength={120} onChange={e => setName(e.target.value)} />}
          </Field>
        </>)}
        <Field label="Amount ₹" error={errors.amount}>
          {id => <Input id={id} type="number" min="0" step="0.01" autoFocus={!!customer} value={amount} onChange={e => setAmount(e.target.value)} />}
        </Field>
        <Field label="Reason" error={errors.note}>
          {id => <Input id={id} value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="Optional, e.g. advance, goodwill" />}
        </Field>
      </div>
    </Modal>
  )
}
