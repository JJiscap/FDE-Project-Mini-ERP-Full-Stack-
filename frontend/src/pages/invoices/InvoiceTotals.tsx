import { formatTHB } from '@/lib/format'

interface InvoiceTotalsProps {
  subtotal: string
  vat: string
  total: string
  paid: string
  balance: string
}

/** Subtotal, VAT 7%, Total, what has been paid and the Balance still owed, each as `9,630.00 THB`. */
export function InvoiceTotals({ subtotal, vat, total, paid, balance }: InvoiceTotalsProps) {
  return (
    <dl className="ml-auto w-full max-w-sm space-y-1.5 rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="tabular whitespace-nowrap" data-testid="subtotal">
          {formatTHB(subtotal)}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-muted-foreground">VAT 7%</dt>
        <dd className="tabular whitespace-nowrap" data-testid="vat">
          {formatTHB(vat)}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t pt-2 text-lg font-semibold">
        <dt>Total</dt>
        <dd className="tabular whitespace-nowrap" data-testid="total">
          {formatTHB(total)}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-muted-foreground">Paid so far</dt>
        <dd className="tabular whitespace-nowrap" data-testid="paid">
          {formatTHB(paid)}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t pt-2 text-lg font-semibold">
        <dt>Balance</dt>
        <dd className="tabular whitespace-nowrap" data-testid="balance">
          {formatTHB(balance)}
        </dd>
      </div>
    </dl>
  )
}
