import type { ComponentType, ReactNode } from 'react'
import { Inbox, type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  /** Say what is empty: "No customers yet". */
  title: string
  /** Say why, or what to do next: "Add your first customer to start selling." */
  description?: ReactNode
  icon?: ComponentType<LucideProps>
  /** A button that fixes the emptiness (e.g. "Add customer"). */
  action?: ReactNode
  className?: string
}

/** Every list shows this instead of a blank screen. */
export function EmptyState({ title, description, icon: Icon = Inbox, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed bg-card px-4 py-12 text-center',
        className,
      )}
    >
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg">{title}</h2>
      {description ? <p className="mt-1 max-w-md text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
