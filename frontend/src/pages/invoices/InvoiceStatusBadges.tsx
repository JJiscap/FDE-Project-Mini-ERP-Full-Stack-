import { StatusBadge } from '@/components/StatusBadge'
import type { InvoiceStatus } from './helpers'

interface InvoiceStatusBadgesProps {
  invoice: { status: InvoiceStatus; overdue: boolean }
}

/**
 * Open or Paid, plus an Overdue badge next to Open when the Due Date has passed.
 * Overdue is a label the API works out; it is not a status of its own (see GLOSSARY).
 */
export function InvoiceStatusBadges({ invoice }: InvoiceStatusBadgesProps) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
      <StatusBadge status={invoice.status} />
      {invoice.overdue ? <StatusBadge status="overdue" /> : null}
    </span>
  )
}
