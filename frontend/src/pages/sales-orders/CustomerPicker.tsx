import { useId, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2, Search, UserRound } from 'lucide-react'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { paymentTermsText, useDebouncedValue, type CustomerChoice, type Page } from './helpers'

const RESULTS = 8

interface CustomerPickerProps {
  /** The chosen Customer, or null while nobody is chosen. */
  value: CustomerChoice | null
  /** Called when a Customer is picked from the results. */
  onChange: (customer: CustomerChoice) => void
  disabled?: boolean
  /** True while the parent is saving the choice. */
  busy?: boolean
}

/**
 * Search box for an active Customer (`GET /api/customers?q=&active=true`). Once one is
 * chosen it shows their name, Tax ID and Payment Terms, with a "Change customer" button.
 */
export function CustomerPicker({ value, onChange, disabled, busy }: CustomerPickerProps) {
  const inputId = useId()
  const [searching, setSearching] = useState(value === null)
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), 250)

  const customers = useQuery({
    queryKey: ['customers', 'list', { q, active: true, picker: true }],
    queryFn: ({ signal }) =>
      api.get<Page<CustomerChoice>>('/customers', { q, active: true, page_size: RESULTS }, signal),
    placeholderData: keepPreviousData,
    enabled: searching,
  })

  if (value && !searching) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-medium break-words" data-testid="chosen-customer">
              {value.name}
            </p>
            <p className="text-sm text-muted-foreground">
              Tax ID <span className="tabular">{value.tax_id}</span> · Payment Terms {paymentTermsText(value.payment_terms_days)}
            </p>
          </div>
        </div>
        {disabled ? null : (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setSearch('')
              setSearching(true)
            }}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Change customer
          </Button>
        )}
      </div>
    )
  }

  const data = customers.data
  const updating = customers.isFetching && customers.isPlaceholderData

  return (
    <div>
      <Label htmlFor={inputId} className="mb-1.5 block">
        Search for a customer
      </Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          type="search"
          className="pl-9"
          placeholder="Type part of the name, e.g. Lune"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {updating ? (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label="Searching"
          />
        ) : null}
      </div>

      {customers.isError ? (
        <ErrorAlert error={customers.error} onRetry={() => void customers.refetch()} className="mt-3" />
      ) : null}

      <div className={cn('mt-2 transition-opacity', updating && 'opacity-60')}>
        {customers.isPending ? (
          <p className="py-3 text-sm text-muted-foreground" role="status">
            Loading customers...
          </p>
        ) : data && data.items.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            {q ? `No active customer matches '${q}'.` : 'There are no active customers yet.'}
          </p>
        ) : data ? (
          <>
            <ul className="divide-y rounded-lg border bg-card" aria-label="Customers">
              {data.items.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    onClick={() => {
                      onChange(customer)
                      setSearching(false)
                    }}
                  >
                    <span className="font-medium break-words">{customer.name}</span>
                    <span className="text-sm text-muted-foreground">
                      Tax ID <span className="tabular">{customer.tax_id}</span> · {paymentTermsText(customer.payment_terms_days)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {data.total > data.items.length ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Showing {data.items.length} of {data.total}. Type more of the name to narrow the list.
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {value ? (
        <Button type="button" variant="ghost" className="mt-2" onClick={() => setSearching(false)}>
          Keep {value.name}
        </Button>
      ) : null}
    </div>
  )
}
