import { cn } from '@/lib/utils'

/** The Siam Bean mark: a coffee bean on a roasted-brown tile. */
export function BeanMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <ellipse cx="16" cy="16" rx="8" ry="11" transform="rotate(35 16 16)" fill="var(--background)" />
      <path d="M11 9.5c4 3 6 9 10 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function Brand({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5 font-semibold tracking-tight', className)}>
      <BeanMark className={markClassName} />
      <span className="text-lg">Siam Bean ERP</span>
    </span>
  )
}
