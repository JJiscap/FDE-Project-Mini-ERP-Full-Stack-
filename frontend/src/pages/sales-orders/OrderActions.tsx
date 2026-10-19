import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/auth/useMe'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { errorMessage } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { canEditSalesOrders } from '@/lib/permissions'
import { cacheOrder, type OrderDetail } from './helpers'

interface OrderActionsProps {
  order: OrderDetail
}

/**
 * The buttons at the top of the order screen. This is the spot for ticket 09 (Confirm):
 *
 *   TICKET 09, add here, next to Cancel (it renders in PageHeader's `action` slot):
 *   - a primary "Confirm order" button, shown for a Draft when `canConfirmOrders(me.role)`,
 *     with a `ConfirmDialog` ("Confirm SO-0012?"), `POST /api/sales-orders/{id}/confirm`,
 *     then `cacheOrder(queryClient, updatedOrder)` and invalidate ['stock'], ['invoices'], ['dashboard'].
 *     A 409 "Not enough stock for ARB-1KG" belongs inside the dialog description, as the Cancel error is below.
 *   - for a Confirmed order, a link to the Invoice: `order.invoice` is `{id, number}` or null.
 *
 * A Draft can be Cancelled (rule 7: orders are cancelled, never deleted). A Confirmed or Cancelled
 * order has no edit actions.
 */
export function OrderActions({ order }: OrderActionsProps) {
  const me = useCurrentUser()
  const queryClient = useQueryClient()
  const [cancelling, setCancelling] = useState(false)

  const cancel = useMutation({
    mutationFn: () => api.post<OrderDetail>(`/sales-orders/${order.id}/cancel`),
    onSuccess: (updated) => {
      cacheOrder(queryClient, updated)
      setCancelling(false)
      toast.success(`${updated.number} cancelled`)
    },
  })

  if (order.status !== 'draft' || !canEditSalesOrders(me.role)) return null

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {/* TICKET 09: the "Confirm order" button goes here, before Cancel. */}
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
