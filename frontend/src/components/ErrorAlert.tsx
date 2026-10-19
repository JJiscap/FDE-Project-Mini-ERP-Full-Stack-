import { CircleAlert, RotateCw } from 'lucide-react'
import { isApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** The message to show a person for any error: the API's `detail`, never just "Error". */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.detail
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return 'Something went wrong. Please try again.'
}

interface ErrorAlertProps {
  error: unknown
  /** Short heading. Defaults to a friendly one based on the kind of error. */
  title?: string
  /** Shows a "Try again" button (use with a query's `refetch`). */
  onRetry?: () => void
  className?: string
}

function defaultTitle(error: unknown): string {
  if (isApiError(error) && [400, 404, 409, 422].includes(error.status)) return 'Please check and try again'
  return 'Something went wrong'
}

/** Banner for a failed request. Put it above the form or list that failed. */
export function ErrorAlert({ error, title, onRetry, className }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-danger',
        className,
      )}
    >
      <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title ?? defaultTitle(error)}</p>
        <p className="mt-0.5 break-words">{errorMessage(error)}</p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" className="mt-3 bg-card" onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  )
}
