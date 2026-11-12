import Modal from './Modal'
import Button from '../ui/Button'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete', loading, tone = 'danger', error }) {
  return (
    <Modal
      isOpen={isOpen} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>}
    >
      <p className="text-sm text-zinc-600">{message}</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Modal>
  )
}
