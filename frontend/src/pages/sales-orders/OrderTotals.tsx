import { formatTHB } from '@/lib/format'

interface OrderTotalsProps {
  subtotal: string
  vat: string
  total: string
}

/** Subtotal, VAT 7% and Total, each as `9,630.00 THB`. */
export function OrderTotals({ subtotal, vat, total }: OrderTotalsProps) {
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
    </dl>
  )
}
