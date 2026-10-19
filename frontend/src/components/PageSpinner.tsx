import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Centered loading indicator for a whole page or section. */
export function PageSpinner({ label = 'Loading...', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 py-16 text-muted-foreground', className)}>
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
