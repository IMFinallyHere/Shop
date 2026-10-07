import { AlertCircle, X } from 'lucide-react'

export default function ErrorAlert({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600" aria-label="Dismiss"><X size={16} /></button>
      )}
    </div>
  )
}
