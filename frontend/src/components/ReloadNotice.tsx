import { CircleAlert, RotateCw } from 'lucide-react'
import { isChunkLoadError } from '@/lib/chunk-errors'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Message and Reload button for a page that could not be shown. A failed lazy-chunk load
 * (usually right after a new version was deployed) gets its own wording. Uses no router,
 * query or auth context, so it is safe at the very top of the app.
 */
export function ReloadNotice({ error, className }: { error: unknown; className?: string }) {
  const newVersion = isChunkLoadError(error)
  return (
    <div
      role="alert"
      className={cn('rounded-lg border border-danger/30 bg-danger-soft px-4 py-5 text-danger', className)}
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">
            {newVersion ? 'A new version of Siam Bean ERP is ready' : 'This page could not be shown'}
          </h2>
          <p className="mt-1">
            {newVersion
              ? 'Reload the page to get it. Anything you already saved is kept.'
              : 'Something went wrong on our side. Reload the page. If it keeps happening, tell the owner what you were doing.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-4 bg-card"
            onClick={() => window.location.reload()}
          >
            <RotateCw aria-hidden="true" />
            Reload page
          </Button>
        </div>
      </div>
    </div>
  )
}
