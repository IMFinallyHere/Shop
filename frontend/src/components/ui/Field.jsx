import clsx from 'clsx'
import { useId } from 'react'

// Label + control + hint/error. Pass the control as a render function to get the id:
// <Field label="Name" error={e}>{id => <Input id={id} … />}</Field>  — or plain children.
export function Field({ label, required, hint, error, className, children }) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-700">
          {label}{required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p>
        : hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  )
}

export function Input({ className, invalid, ...props }) {
  return <input className={clsx('input', invalid && 'input-error', className)} {...props} />
}

export function Select({ className, invalid, children, ...props }) {
  return (
    <select className={clsx('input pr-8', invalid && 'input-error', className)} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className, invalid, ...props }) {
  return <textarea className={clsx('input min-h-[80px]', invalid && 'input-error', className)} {...props} />
}

export function Checkbox({ label, description, className, ...props }) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-2.5 text-sm text-zinc-700', className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 accent-brand-600" {...props} />
      <span>
        {label}
        {description && <span className="block text-xs text-zinc-500">{description}</span>}
      </span>
    </label>
  )
}
