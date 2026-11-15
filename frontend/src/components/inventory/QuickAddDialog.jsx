import { useState } from 'react'
import { createCategory, createSeller } from '../../api/inventory'
import Modal from '../common/Modal'
import ErrorAlert from '../common/ErrorAlert'
import Button from '../ui/Button'
import { useToast } from '../ui/Toast'
import CategoryForm from '../forms/CategoryForm'
import SellerForm from '../forms/SellerForm'
import { EMPTY_CATEGORY, EMPTY_SELLER, parseApiErrors, sellerBody, sellerErrors } from '../../utils/inventoryForms'

// The full "new category" / "new seller" form, opened from a dropdown in the product form.
// `kind` = 'category' | 'seller'; `initialName` = what the user had typed. Calls
// onCreated(record) after saving, onClose() on cancel.
export default function QuickAddDialog({ kind, initialName = '', onCreated, onClose }) {
  const isSeller = kind === 'seller'
  const [form, setForm] = useState(() => ({ ...(isSeller ? EMPTY_SELLER : EMPTY_CATEGORY), name: initialName }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const toast = useToast()

  const save = async () => {
    if (saving) return
    const local = isSeller ? sellerErrors(form) : {}
    if (Object.keys(local).length) { setErrors(local); setError(''); return }
    setSaving(true); setError(''); setErrors({})
    try {
      const { data } = await (isSeller ? createSeller(sellerBody(form)) : createCategory(form))
      toast(isSeller ? 'Seller added' : 'Category created')
      onCreated(data)
    } catch (e) {
      const { fields, general } = parseApiErrors(e)
      setErrors(fields); setError(general)
    } finally { setSaving(false) }
  }

  return (
    <Modal isOpen onClose={onClose} title={isSeller ? 'New seller' : 'New category'} size={isSeller ? 'md' : 'sm'}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} loading={saving}>Save</Button></>}>
      <ErrorAlert message={error} />
      {isSeller
        ? <SellerForm form={form} onChange={setForm} errors={errors} />
        : <CategoryForm form={form} onChange={setForm} errors={errors} onSubmit={save} />}
    </Modal>
  )
}
