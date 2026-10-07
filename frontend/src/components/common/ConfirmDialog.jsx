import Modal from './Modal'
import Button from '../ui/Button'

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete', loading, tone = 'danger' }) {
  return (
    <Modal
      isOpen={isOpen} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>}
    >
      <p className="text-sm text-zinc-600">{message}</p>
    </Modal>
  )
}
