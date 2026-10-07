import { createContext, useCallback, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), [])

  // toast('Saved') or toast('Failed', 'error')
  const toast = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t.slice(-2), { id, message, tone }])
    setTimeout(() => dismiss(id), 3500)
  }, [dismiss])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[10000] flex flex-col gap-2">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto flex min-w-[260px] max-w-sm animate-pop-in items-start gap-2.5 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 shadow-pop">
              {t.tone === 'error'
                ? <AlertCircle size={18} className="mt-px shrink-0 text-red-500" />
                : <CheckCircle2 size={18} className="mt-px shrink-0 text-emerald-500" />}
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="text-zinc-400 hover:text-zinc-700"><X size={16} /></button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
