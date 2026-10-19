import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/auth/useMe'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PageHeader } from '@/components/PageHeader'
import { PageSpinner } from '@/components/PageSpinner'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { canEditCustomers } from '@/lib/permissions'
import { InactiveBadge } from './CustomerList'
import { paymentTermsLabel, type Customer } from './helpers'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words whitespace-pre-line">{children}</dd>
    </div>
  )
}

/** One Customer. Admin and Sales can edit and deactivate; the Accountant sees it read-only. */
export function CustomerDetail() {
  const { id } = useParams()
  const me = useCurrentUser()
  const canEdit = canEditCustomers(me.role)
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const customer = useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: ({ signal }) => api.get<Customer>(`/customers/${id}`, undefined, signal),
  })

  const setActive = useMutation({
    mutationFn: (active: boolean) => api.patch<Customer>(`/customers/${id}`, { active }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      setConfirming(false)
      toast.success(saved.active ? 'Customer reactivated' : 'Customer deactivated')
    },
  })

  const back = (
    <Link to="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Customers
    </Link>
  )

  if (customer.isPending) return <PageSpinner />
  if (customer.isError) {
    return (
      <div className="max-w-2xl">
        {back}
        <ErrorAlert error={customer.error} onRetry={() => void customer.refetch()} />
      </div>
    )
  }

  const c = customer.data

  return (
    <div className="max-w-2xl">
      {back}
      <PageHeader
        title={c.name}
        description={
          <span className="inline-flex items-center gap-2">
            {c.active ? <StatusBadge status="active" /> : <InactiveBadge />}
          </span>
        }
        action={
          canEdit ? (
            <Button asChild size="lg">
              <Link to={`/customers/${c.id}/edit`}>
                <Pencil aria-hidden="true" />
                Edit customer
              </Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent>
          <dl className="space-y-4">
            <Field label="Tax ID">
              <span className="tabular">{c.tax_id}</span>
            </Field>
            <Field label="Payment Terms">{paymentTermsLabel(c.payment_terms_days)}</Field>
            <Field label="Address">{c.address ?? '–'}</Field>
            <Field label="Phone">{c.phone ?? '–'}</Field>
          </dl>
        </CardContent>
      </Card>

      {canEdit ? (
        <div className="mt-4">
          {c.active ? (
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setConfirming(true)}>
              Deactivate customer
            </Button>
          ) : (
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setConfirming(true)}>
              Reactivate customer
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">You can view customers but not change them.</p>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open)
          if (!open) setActive.reset()
        }}
        title={c.active ? `Deactivate ${c.name}?` : `Reactivate ${c.name}?`}
        description={
          <>
            {c.active
              ? 'It will no longer be offered when you start a new Sales Order. Existing orders and Invoices keep showing it. You can reactivate it any time.'
              : 'It will be offered again when you start a new Sales Order.'}
            {setActive.isError ? <ErrorAlert error={setActive.error} className="mt-3 text-left" /> : null}
          </>
        }
        confirmLabel={c.active ? 'Deactivate customer' : 'Reactivate customer'}
        destructive={c.active}
        loading={setActive.isPending}
        onConfirm={() => setActive.mutate(!c.active)}
      />
    </div>
  )
}
