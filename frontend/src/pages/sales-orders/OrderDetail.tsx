import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/auth/useMe'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PageHeader } from '@/components/PageHeader'
import { PageSpinner } from '@/components/PageSpinner'
import { StatusBadge } from '@/components/StatusBadge'
import { api } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/format'
import { canEditSalesOrders } from '@/lib/permissions'
import { CustomerPicker } from './CustomerPicker'
import { LinesEditor, type LineRow } from './LinesEditor'
import { OrderActions } from './OrderActions'
import { OrderTotals } from './OrderTotals'
import { ProductPicker } from './ProductPicker'
import { cacheOrder, orderKey, type CustomerChoice, type OrderDetail as Order, type ProductChoice } from './helpers'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  )
}

/**
 * One Sales Order. A Draft can be edited: change the Customer, change a quantity, remove a line,
 * add a Product, or cancel it. Confirmed and Cancelled orders are read-only.
 * The Unit Price of a line is frozen when it is added; the server keeps it that way.
 */
export function OrderDetail() {
  const { id = '' } = useParams()
  const me = useCurrentUser()
  const queryClient = useQueryClient()
  const [busyLine, setBusyLine] = useState<number | null>(null)

  const order = useQuery({
    queryKey: orderKey(id),
    queryFn: ({ signal }) => api.get<Order>(`/sales-orders/${id}`, undefined, signal),
  })

  // Every edit answers with the whole updated order, which replaces the cached one.
  const edit = useMutation({
    mutationFn: (request: () => Promise<Order>) => request(),
    onSuccess: (updated) => cacheOrder(queryClient, updated),
    onError: () => void queryClient.invalidateQueries({ queryKey: orderKey(id) }),
  })
  const run = (request: () => Promise<Order>) =>
    edit.mutateAsync(request).then(
      () => true,
      () => false,
    )

  const back = (
    <Link
      to="/sales-orders"
      className="mb-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Sales Orders
    </Link>
  )

  if (order.isPending) return <PageSpinner />
  if (order.isError) {
    return (
      <div className="max-w-3xl">
        {back}
        <ErrorAlert error={order.error} onRetry={() => void order.refetch()} />
      </div>
    )
  }

  const o = order.data
  const editable = o.status === 'draft' && canEditSalesOrders(me.role)
  const base = `/sales-orders/${o.id}`

  const rows: LineRow[] = o.lines.map((l) => ({
    key: l.id,
    sku: l.sku,
    name: l.name,
    unit: l.unit,
    quantity: l.quantity,
    unit_price: l.unit_price,
    amount: l.amount,
    on_hand: l.on_hand,
  }))

  async function changeCustomer(customer: CustomerChoice) {
    if (customer.id === o.customer.id) return
    const saved = await run(() => api.patch<Order>(base, { customer_id: customer.id }))
    if (saved) toast.success(`Customer changed to ${customer.name}`)
  }

  async function changeQuantity(lineId: LineRow['key'], quantity: number) {
    setBusyLine(Number(lineId))
    const saved = await run(() => api.patch<Order>(`${base}/lines/${lineId}`, { quantity }))
    setBusyLine(null)
    return saved
  }

  async function removeLine(lineId: LineRow['key']) {
    setBusyLine(Number(lineId))
    await run(() => api.delete<Order>(`${base}/lines/${lineId}`))
    setBusyLine(null)
  }

  function addLine(product: ProductChoice, quantity: number) {
    return run(() => api.post<Order>(`${base}/lines`, { product_id: product.id, quantity }))
  }

  return (
    <div className="max-w-3xl">
      {back}
      <PageHeader
        title={o.number}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge status={o.status} />
            <span>Order date {formatDate(o.order_date)}</span>
          </span>
        }
        action={<OrderActions order={o} />}
      />

      {o.status === 'cancelled' ? (
        <p className="mb-6 rounded-lg border bg-muted px-4 py-3 text-muted-foreground">
          This order was cancelled. It keeps the number {o.number} and can't be changed.
        </p>
      ) : null}
      {o.status === 'confirmed' ? (
        <p className="mb-6 rounded-lg border bg-info-soft px-4 py-3 text-info">
          Confirmed{o.confirmed_at ? ` on ${formatDateTime(o.confirmed_at)}` : ''}. This order is final and can't be
          changed.
        </p>
      ) : null}

      {edit.isError ? <ErrorAlert error={edit.error} className="mb-6" /> : null}

      <div className="space-y-8">
        <Section title="Customer">
          <CustomerPicker value={o.customer} onChange={(c) => void changeCustomer(c)} disabled={!editable} busy={edit.isPending && busyLine === null} />
        </Section>

        <Section title="Order lines">
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card px-4 py-6 text-center text-muted-foreground">
              {editable ? 'No products on this order yet. Search below and add the first one.' : 'This order has no lines.'}
            </p>
          ) : (
            <LinesEditor
              lines={rows}
              editable={editable}
              busyKey={busyLine}
              onChangeQuantity={changeQuantity}
              onRemove={(lineId) => void removeLine(lineId)}
            />
          )}
        </Section>

        {editable ? (
          <Section title="Add a product">
            <ProductPicker onAdd={addLine} busy={edit.isPending && busyLine === null} />
          </Section>
        ) : null}

        <Section title="Totals">
          <OrderTotals subtotal={o.subtotal} vat={o.vat} total={o.total} />
        </Section>
      </div>
    </div>
  )
}
