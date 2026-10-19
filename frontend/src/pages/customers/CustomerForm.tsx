import { Link, useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useCurrentUser } from '@/auth/useMe'
import { AccessDenied } from '@/components/AccessDenied'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PageHeader } from '@/components/PageHeader'
import { PageSpinner } from '@/components/PageSpinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { canEditCustomers } from '@/lib/permissions'
import type { Customer } from './helpers'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the customer name'),
  tax_id: z.string().trim().min(1, 'Tax ID is required'),
  payment_terms_days: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Payment Terms must be 0 or more whole days (0 means Cash)'),
  address: z.string().trim(),
  phone: z.string().trim(),
})
type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = { name: '', tax_id: '', payment_terms_days: '0', address: '', phone: '' }

function toForm(c: Customer): FormValues {
  return {
    name: c.name,
    tax_id: c.tax_id,
    payment_terms_days: String(c.payment_terms_days),
    address: c.address ?? '',
    phone: c.phone ?? '',
  }
}

function CustomerFormFields({ customer }: { customer?: Customer }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: customer ? toForm(customer) : EMPTY,
  })

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const body = { ...values, payment_terms_days: Number(values.payment_terms_days) }
      return customer
        ? api.patch<Customer>(`/customers/${customer.id}`, body)
        : api.post<Customer>('/customers', body)
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success(customer ? 'Customer saved' : 'Customer added')
      navigate(`/customers/${saved.id}`)
    },
  })

  return (
    <Card>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => save.mutate(values))} noValidate className="space-y-4">
            {save.isError ? <ErrorAlert error={save.error} /> : null}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tax_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax ID</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" inputMode="numeric" {...field} />
                  </FormControl>
                  <FormDescription>Required on every Invoice. Branches may share one Tax ID.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_terms_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Terms (days)</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" className="sm:max-w-40" {...field} />
                  </FormControl>
                  <FormDescription>0 means Cash. 30 means the Invoice is due 30 days after it is issued.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="tel" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" asChild>
                <Link to={customer ? `/customers/${customer.id}` : '/customers'}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {save.isPending ? 'Saving...' : customer ? 'Save customer' : 'Add customer'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="mb-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  )
}

export function NewCustomer() {
  const me = useCurrentUser()
  if (!canEditCustomers(me.role)) return <AccessDenied />
  return (
    <div className="max-w-2xl">
      <BackLink to="/customers">Customers</BackLink>
      <PageHeader title="New customer" description="Name and Tax ID are required." />
      <CustomerFormFields />
    </div>
  )
}

export function EditCustomer() {
  const me = useCurrentUser()
  const { id } = useParams()
  const customer = useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: ({ signal }) => api.get<Customer>(`/customers/${id}`, undefined, signal),
    enabled: canEditCustomers(me.role),
  })

  if (!canEditCustomers(me.role)) return <AccessDenied />
  if (customer.isPending) return <PageSpinner />
  if (customer.isError) {
    return (
      <div className="max-w-2xl">
        <BackLink to="/customers">Customers</BackLink>
        <ErrorAlert error={customer.error} onRetry={() => void customer.refetch()} />
      </div>
    )
  }
  return (
    <div className="max-w-2xl">
      <BackLink to={`/customers/${customer.data.id}`}>{customer.data.name}</BackLink>
      <PageHeader title="Edit customer" />
      <CustomerFormFields customer={customer.data} />
    </div>
  )
}
