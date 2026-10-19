import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** The ONE primary action of the screen (e.g. a "New sales order" button). */
  action?: ReactNode
  className?: string
}

/**
 * Title row for every page. The action slot goes full width on phones so it is
 * easy to tap, and sits at the right on larger screens.
 */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight">{title}</h1>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? (
        <div className="shrink-0 [&>*]:w-full sm:[&>*]:w-auto">{action}</div>
      ) : null}
    </header>
  )
}
