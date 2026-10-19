import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { CustomerPicker } from './CustomerPicker'
import { LinesEditor, type LineRow } from './LinesEditor'
import { OrderTotals } from './OrderTotals'
import { ProductPicker } from './ProductPicker'
import {
  addDraftLine,
  cacheOrder,
  computeTotals,
  lineAmount,
  removeDraftLine,
  setDraftQuantity,
  type CustomerChoice,
  type DraftLine,
  type OrderDetail,
} from './helpers'

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3" aria-labelledby={`step-${number}`}>
      <h2 id={`step-${number}`} className="flex items-center gap-2 text-lg">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground"
          aria-hidden="true"
        >
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * New order: 1. pick the Customer, 2. add Products with a quantity, 3. check the totals and
 * save as a Draft. Nothing is sent until "Save as Draft". Totals are live; stock only warns.
 */
export function NewOrder() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [customer, setCustomer] = useState<CustomerChoice | null>(null)
  const [lines, setLines] = useState<DraftLine[]>([])

  const save = useMutation({
    mutationFn: (customerId: number) =>
      api.post<OrderDetail>('/sales-orders', {
        customer_id: customerId,
        lines: lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
      }),
    onSuccess: (order) => {
      cacheOrder(queryClient, order)
      toast.success(`${order.number} saved as a Draft`)
      navigate(`/sales-orders/${order.id}`)
    },
  })

  const rows: LineRow[] = lines.map((l) => ({
    key: l.product_id,
    sku: l.sku,
    name: l.name,
    unit: l.unit,
    quantity: l.quantity,
    unit_price: l.unit_price,
    amount: lineAmount(l.quantity, l.unit_price),
    on_hand: l.on_hand,
  }))
  const totals = computeTotals(lines)

  return (
    <div className="max-w-3xl">
      <Link
        to="/sales-orders"
        className="mb-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Sales Orders
      </Link>
      <PageHeader
        title="New order"
        description="Pick the Customer, add the products, then save. The order stays a Draft until you confirm it."
      />

      <div className="space-y-8">
        <Step number={1} title="Customer">
          <CustomerPicker value={customer} onChange={setCustomer} />
        </Step>

        <Step number={2} title="Products">
          <ProductPicker
            onAdd={(product, quantity) => {
              setLines((current) => addDraftLine(current, product, quantity))
              return true
            }}
          />
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card px-4 py-6 text-center text-muted-foreground">
              No products on this order yet. Search above and add the first one.
            </p>
          ) : (
            <LinesEditor
              lines={rows}
              editable
              live
              onChangeQuantity={(key, quantity) => setLines((current) => setDraftQuantity(current, Number(key), quantity))}
              onRemove={(key) => setLines((current) => removeDraftLine(current, Number(key)))}
            />
          )}
        </Step>

        <Step number={3} title="Check and save">
          <OrderTotals {...totals} />
          {save.isError ? <ErrorAlert error={save.error} /> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {customer ? null : (
              <p className="text-sm text-muted-foreground sm:mr-2">Choose a customer to save the order.</p>
            )}
            <Button
              type="button"
              size="lg"
              disabled={!customer || save.isPending}
              onClick={() => customer && save.mutate(customer.id)}
            >
              {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              {save.isPending ? 'Saving...' : 'Save as Draft'}
            </Button>
          </div>
        </Step>
      </div>
    </div>
  )
}
