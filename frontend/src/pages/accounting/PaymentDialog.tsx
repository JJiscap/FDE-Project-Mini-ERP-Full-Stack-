import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { formatTHB, todayInBangkok } from '@/lib/format'
import { cn } from '@/lib/utils'
import { cacheInvoice, refreshAfterPayment, type InvoiceDetail } from '@/pages/invoices/helpers'
import {
  PAYMENT_METHODS,
  balanceAfter,
  parseAmount,
  paymentBody,
  successMessage,
  type PaymentBody,
  type PaymentMethod,
} from './payment'

/** What the dialog needs to know about the Invoice (a list row has all of it). */
export interface PayableInvoice {
  id: number
  number: string
  balance: string
  customer: { name: string }
}

interface PaymentDialogProps {
  invoice: PayableInvoice
  onClose: () => void
}

/**
 * Record a Payment against an Open Invoice (US-4). The Amount starts as the whole Balance, the date as
 * today in Bangkok and the method as bank transfer. Mounted only while open, so it always starts fresh.
 *
 * The checks here are a convenience; the server decides. When it refuses (a Payment above the Balance, or
 * an Invoice someone else just paid) its message is shown inside the dialog, which stays open, and the
 * lists refresh so the Balance on screen is the current one.
 */
export function PaymentDialog({ invoice, onClose }: PaymentDialogProps) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState(invoice.balance)
  const [paidOn, setPaidOn] = useState(todayInBangkok())
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<{ amount?: string; paid_on?: string }>({})

  const record = useMutation({
    mutationFn: (body: PaymentBody) => api.post<InvoiceDetail>(`/invoices/${invoice.id}/payments`, body),
    onSuccess: (updated, body) => {
      cacheInvoice(queryClient, updated)
      toast.success(successMessage(updated.number, body.amount, updated.balance))
      onClose()
    },
    onError: () => refreshAfterPayment(queryClient),
  })

  const parsed = parseAmount(amount, invoice.balance)
  const preview = parsed.ok ? balanceAfter(invoice.balance, parsed.value) : null

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    if (!parsed.ok) next.amount = parsed.message
    if (paidOn.trim() === '') next.paid_on = 'Payment date is required'
    setErrors(next)
    if (!parsed.ok || next.paid_on) return
    record.mutate(paymentBody({ amount: parsed.value, paid_on: paidOn, method, note }))
  }

  return (
    <Dialog open onOpenChange={(open) => (!open && !record.isPending ? onClose() : undefined)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment for {invoice.number}</DialogTitle>
          <DialogDescription>
            {invoice.customer.name} · Balance {formatTHB(invoice.balance)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {record.isError ? <ErrorAlert error={record.error} /> : null}

          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount (THB)</Label>
            <Input
              id="payment-amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setErrors((x) => ({ ...x, amount: undefined }))
                record.reset()
              }}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby="payment-amount-hint"
            />
            {errors.amount ? <p className="text-sm text-destructive">{errors.amount}</p> : null}
            <p id="payment-amount-hint" className="text-sm text-muted-foreground" aria-live="polite">
              {preview !== null
                ? `Balance after this payment: ${formatTHB(preview)}.${preview === '0.00' ? ' The Invoice will be marked Paid.' : ''}`
                : 'Part of the Balance is fine. The Invoice is Paid when nothing is left to pay.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-date">Payment date</Label>
            <Input
              id="payment-date"
              type="date"
              value={paidOn}
              onChange={(e) => {
                setPaidOn(e.target.value)
                setErrors((x) => ({ ...x, paid_on: undefined }))
              }}
              aria-invalid={Boolean(errors.paid_on)}
            />
            {errors.paid_on ? <p className="text-sm text-destructive">{errors.paid_on}</p> : null}
          </div>

          <div className="space-y-2">
            <span id="payment-method-label" className="text-sm leading-none font-medium">
              Method
            </span>
            <div
              role="radiogroup"
              aria-labelledby="payment-method-label"
              className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
            >
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={method === m.value}
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    'min-h-11 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    method === m.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-note">Note (optional)</Label>
            <Input
              id="payment-note"
              autoComplete="off"
              maxLength={500}
              value={note}
              placeholder="e.g. transfer slip no. 4471"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={record.isPending}>
              Go back
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
