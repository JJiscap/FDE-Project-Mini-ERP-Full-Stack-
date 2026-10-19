import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, HandCoins } from 'lucide-react'
import { useCurrentUser } from '@/auth/useMe'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { PageSpinner } from '@/components/PageSpinner'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatDate, formatQty, formatTHB } from '@/lib/format'
import { canAccess, canRecordPayments } from '@/lib/permissions'
import { methodLabel } from '@/pages/accounting/payment'
import { PaymentDialog } from '@/pages/accounting/PaymentDialog'
import { overdueLabel, invoiceKey, type InvoiceDetail as Invoice, type InvoiceLine, type Payment } from './helpers'
import { InvoiceStatusBadges } from './InvoiceStatusBadges'
import { InvoiceTotals } from './InvoiceTotals'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  )
}

const lineColumns: Column<InvoiceLine>[] = [
  {
    header: 'Product',
    isTitle: true,
    cell: (l) => (
      <>
        <span className="tabular">{l.sku}</span>
        <span className="block text-sm font-normal text-muted-foreground">{l.name}</span>
      </>
    ),
  },
  { header: 'Quantity', align: 'right', cell: (l) => <span className="tabular whitespace-nowrap">{formatQty(l.quantity, l.unit)}</span> },
  { header: 'Unit price', align: 'right', cell: (l) => <Money value={l.unit_price} /> },
  { header: 'Amount', align: 'right', cell: (l) => <Money value={l.amount} strong /> },
]

const paymentColumns: Column<Payment>[] = [
  { header: 'Date', isTitle: true, cell: (p) => formatDate(p.paid_on) },
  { header: 'Method', cell: (p) => methodLabel(p.method) },
  { header: 'Note', cell: (p) => <span className="break-words">{p.note ?? '–'}</span> },
  { header: 'Recorded by', cell: (p) => p.recorded_by ?? '–' },
  { header: 'Amount', align: 'right', cell: (p) => <Money value={p.amount} strong /> },
]

function termsLabel(days: number): string {
  return days === 0 ? 'Cash' : `${days} days`
}

/**
 * One Invoice (Admin, Sales, Accountant): Customer with Tax ID, lines, Subtotal, VAT 7%, Total, Due Date,
 * Payments and Balance. Admin and Accountant can record a Payment while it is Open (the same dialog as
 * the Accounting screen). Sales get a link back to the Sales Order; the Accountant cannot open Sales Orders.
 */
export function InvoiceDetail() {
  const { id = '' } = useParams()
  const me = useCurrentUser()
  const [paying, setPaying] = useState(false)

  const invoice = useQuery({
    queryKey: invoiceKey(id),
    queryFn: ({ signal }) => api.get<Invoice>(`/invoices/${id}`, undefined, signal),
  })

  const back = (
    <Link
      to="/invoices"
      className="mb-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Invoices
    </Link>
  )

  if (invoice.isPending) return <PageSpinner />
  if (invoice.isError) {
    return (
      <div className="max-w-3xl">
        {back}
        <ErrorAlert error={invoice.error} onRetry={() => void invoice.refetch()} />
      </div>
    )
  }

  const inv = invoice.data
  const canPay = inv.status === 'open' && canRecordPayments(me.role)

  return (
    <div className="max-w-3xl">
      {back}
      <PageHeader
        title={inv.number}
        description={<InvoiceStatusBadges invoice={inv} />}
        action={
          canPay ? (
            <Button type="button" size="lg" onClick={() => setPaying(true)}>
              <HandCoins aria-hidden="true" />
              Record payment
            </Button>
          ) : null
        }
      />

      {inv.status === 'paid' ? (
        <p className="mb-6 rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-success">
          Paid in full. Nothing more is owed on this Invoice.
        </p>
      ) : null}
      {inv.overdue ? (
        <p className="mb-6 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-danger">
          {overdueLabel(inv.days_overdue)}. {formatTHB(inv.balance)} is still owed.
        </p>
      ) : null}

      <div className="space-y-8">
        <Section title="Details">
          <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
            <Field label="Customer">
              <span className="block font-medium">{inv.customer.name}</span>
              <span className="tabular block text-sm text-muted-foreground">Tax ID {inv.customer.tax_id}</span>
              {inv.customer.address ? (
                <span className="block text-sm text-muted-foreground">{inv.customer.address}</span>
              ) : null}
            </Field>
            <Field label="Sales Order">
              {canAccess(me.role, 'sales-orders') ? (
                <Link to={`/sales-orders/${inv.order.id}`} className="tabular text-primary underline-offset-4 hover:underline">
                  {inv.order.number}
                </Link>
              ) : (
                <span className="tabular">{inv.order.number}</span>
              )}
            </Field>
            <Field label="Invoice date">{formatDate(inv.invoice_date)}</Field>
            <Field label="Due date">
              {formatDate(inv.due_date)}{' '}
              <span className="text-sm text-muted-foreground">(Payment Terms: {termsLabel(inv.customer.payment_terms_days)})</span>
            </Field>
          </dl>
        </Section>

        <Section title="Invoice lines">
          <DataTable
            caption="Invoice lines"
            columns={lineColumns}
            rows={inv.lines}
            getRowKey={(l) => l.id}
            empty={<EmptyState title="No lines" description="This Invoice has no lines." />}
          />
        </Section>

        <Section title="Totals">
          <InvoiceTotals
            subtotal={inv.subtotal}
            vat={inv.vat}
            total={inv.total}
            paid={inv.paid}
            balance={inv.balance}
          />
        </Section>

        <Section title="Payments">
          <DataTable
            caption="Payments"
            columns={paymentColumns}
            rows={inv.payments}
            getRowKey={(p) => p.id}
            empty={
              <EmptyState
                icon={HandCoins}
                title="No payments yet"
                description={
                  canRecordPayments(me.role)
                    ? 'Record a Payment when the Customer pays.'
                    : 'Payments appear here once the Accountant records them.'
                }
              />
            }
          />
        </Section>
      </div>

      {paying ? (
        <PaymentDialog
          invoice={{ id: inv.id, number: inv.number, balance: inv.balance, customer: { name: inv.customer.name } }}
          onClose={() => setPaying(false)}
        />
      ) : null}
    </div>
  )
}
