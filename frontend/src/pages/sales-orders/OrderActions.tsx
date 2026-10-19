import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, CircleCheck, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/auth/useMe'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { errorMessage } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatQty, formatTHB } from '@/lib/format'
import { canAccess, canConfirmOrders, canEditSalesOrders } from '@/lib/permissions'
import { cacheOrder, type OrderDetail } from './helpers'

interface OrderActionsProps {
  order: OrderDetail
}

/** Everything a Confirm changes besides the order itself: stock, product lists, Invoices, the Dashboard. */
const REFRESHED_AFTER_CONFIRM = [['stock'], ['products'], ['invoices'], ['dashboard']] as const

/**
 * The buttons at the top of the order screen (PageHeader's `action` slot).
 *
 * - Draft: the primary "Confirm order" button (Admin and Sales), which asks first and shows the Total, and
 *   "Cancel order". Confirm takes the stock out and issues the Invoice in one step, so it cannot be undone.
 *   A refusal such as "Not enough stock for ARB-1KG" is shown inside the dialog, which stays open.
 * - Confirmed: a link to the Invoice (`order.invoice` is `{id, number}`). A Confirmed order has no edit actions.
 * - Cancelled: nothing (rule 7: orders are cancelled, never deleted).
 */
export function OrderActions({ order }: OrderActionsProps) {
  const me = useCurrentUser()
  const queryClient = useQueryClient()
  const [cancelling, setCancelling] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const cancel = useMutation({
    mutationFn: () => api.post<OrderDetail>(`/sales-orders/${order.id}/cancel`),
    onSuccess: (updated) => {
      cacheOrder(queryClient, updated)
      setCancelling(false)
      toast.success(`${updated.number} cancelled`)
    },
  })

  const confirm = useMutation({
    mutationFn: () => api.post<OrderDetail>(`/sales-orders/${order.id}/confirm`),
    onSuccess: (updated) => {
      cacheOrder(queryClient, updated)
      for (const queryKey of REFRESHED_AFTER_CONFIRM) void queryClient.invalidateQueries({ queryKey })
      setConfirming(false)
      toast.success(
        updated.invoice
          ? `${updated.number} confirmed. Invoice ${updated.invoice.number} issued.`
          : `${updated.number} confirmed.`,
      )
    },
  })

  if (order.status === 'confirmed') {
    if (!order.invoice || !canAccess(me.role, 'invoices')) return null
    return (
      <Button asChild size="lg">
        <Link to={`/invoices/${order.invoice.id}`}>
          <ReceiptText aria-hidden="true" />
          Open {order.invoice.number}
        </Link>
      </Button>
    )
  }

  if (order.status !== 'draft' || !canEditSalesOrders(me.role)) return null

  const canConfirm = canConfirmOrders(me.role)
  const empty = order.lines.length === 0
  const sold = order.lines.map((line) => `${formatQty(line.quantity, line.unit)} of ${line.sku}`).join(', ')

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      {canConfirm ? (
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="lg"
            disabled={empty}
            aria-describedby={empty ? 'confirm-hint' : undefined}
            onClick={() => {
              confirm.reset()
              setConfirming(true)
            }}
          >
            <CircleCheck aria-hidden="true" />
            Confirm order
          </Button>
          {empty ? (
            <p id="confirm-hint" className="text-sm text-muted-foreground">
              Add at least one product to confirm.
            </p>
          ) : null}
        </div>
      ) : null}
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="text-danger"
        onClick={() => {
          cancel.reset()
          setCancelling(true)
        }}
      >
        <Ban aria-hidden="true" />
        Cancel order
      </Button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Confirm ${order.number}?`}
        description={
          <>
            <span className="block">
              This takes {sold} out of stock and issues an Invoice to {order.customer.name}. It can't be undone.
            </span>
            <span className="mt-3 block text-base font-semibold text-foreground">
              Total {formatTHB(order.total)} <span className="font-normal text-muted-foreground">(incl. 7% VAT)</span>
            </span>
            {confirm.isError ? (
              <span role="alert" className="mt-3 block rounded-md bg-danger-soft px-3 py-2 text-left text-danger">
                {errorMessage(confirm.error)}
              </span>
            ) : null}
          </>
        }
        confirmLabel="Confirm order"
        loading={confirm.isPending}
        onConfirm={() => confirm.mutate()}
      />

      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${order.number}?`}
        description={
          <>
            <span className="block">
              {order.number} will be marked Cancelled and can't be changed again. It keeps its number, and no stock is
              taken out.
            </span>
            {cancel.isError ? (
              <span role="alert" className="mt-3 block rounded-md bg-danger-soft px-3 py-2 text-left text-danger">
                {errorMessage(cancel.error)}
              </span>
            ) : null}
          </>
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
      />
    </div>
  )
}
