import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A question that names the thing: "Confirm SO-0012?" not "Are you sure?" */
  title: string
  /** What will happen, and whether it can be undone. */
  description: ReactNode
  /** Names the action: "Confirm order", "Deactivate product". */
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  /** Red button, for actions that remove something from daily use. */
  destructive?: boolean
  /** Keeps the dialog open and disables the buttons while the request runs. */
  loading?: boolean
}

/**
 * Asks before an action that cannot be undone (Confirm order, Cancel order, Deactivate).
 * The parent closes it, so the dialog stays open while loading and when the API refuses.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Go back',
  onConfirm,
  destructive,
  loading,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (!loading ? onOpenChange(next) : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {/* A div, not Radix's default <p>: the description may hold block content such as an error alert. */}
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
