import clsx from 'clsx'

// A keyboard-key hint, e.g. <Kbd>N</Kbd>. Hidden on phones, which have no keyboard.
// `onDark` for use inside a filled (primary) button.
export default function Kbd({ children, onDark = false, className }) {
  return (
    <kbd className={clsx(
      'hidden min-w-[1.25rem] items-center justify-center rounded border px-1 font-sans text-[11px] font-semibold leading-[18px] lg:inline-flex',
      onDark ? 'border-white/40 bg-white/15 text-white' : 'border-zinc-200 bg-white text-zinc-500',
      className,
    )}>{children}</kbd>
  )
}
