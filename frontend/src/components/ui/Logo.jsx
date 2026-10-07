import clsx from 'clsx'

// App mark (same artwork as public/favicon.svg).
export default function Logo({ size = 32, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={clsx('shrink-0', className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-brand-600" />
      <path d="M9.5 12.5h13l-1 11.2a1.5 1.5 0 0 1-1.5 1.3h-8a1.5 1.5 0 0 1-1.5-1.3l-1-11.2Z" fill="#fff" />
      <path d="M12.5 12.5V11a3.5 3.5 0 0 1 7 0v1.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="18" r="1.6" className="fill-brand-600" />
    </svg>
  )
}
