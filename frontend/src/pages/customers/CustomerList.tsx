import { useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CircleSlash, Loader2, Plus, Search, Users } from 'lucide-react'
import { useCurrentUser } from '@/auth/useMe'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { canEditCustomers } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import {
  PAGE_SIZE,
  emptyListMessage,
  pagerLabel,
  paymentTermsLabel,
  useDebouncedValue,
  type ActiveFilter,
  type Customer,
  type CustomerPage,
} from './helpers'

/** Local "Inactive" badge (the shared one says "Deactivated"; the ticket asks for "Inactive"). */
export function InactiveBadge() {
  return (
    <Badge variant="outline" className="gap-1 border-border bg-muted text-muted-foreground">
      <CircleSlash aria-hidden="true" />
      Inactive
    </Badge>
  )
}

const columns: Column<Customer>[] = [
  {
    header: 'Name',
    isTitle: true,
    cell: (c) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="break-words">{c.name}</span>
        {c.active ? null : <InactiveBadge />}
      </span>
    ),
  },
  { header: 'Tax ID', cell: (c) => <span className="tabular">{c.tax_id}</span> },
  { header: 'Payment Terms', cell: (c) => paymentTermsLabel(c.payment_terms_days) },
  { header: 'Phone', cell: (c) => c.phone ?? '–' },
]

export function CustomerList() {
  const me = useCurrentUser()
  const canEdit = canEditCustomers(me.role)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ActiveFilter>('active')
  const [page, setPage] = useState(1)
  const q = useDebouncedValue(search.trim(), 300)

  const customers = useQuery({
    queryKey: ['customers', 'list', { q, filter, page }],
    queryFn: ({ signal }) =>
      api.get<CustomerPage>(
        '/customers',
        { q, active: filter === 'all' ? undefined : filter === 'active', page, page_size: PAGE_SIZE },
        signal,
      ),
    placeholderData: keepPreviousData, // keep the old rows visible while the next ones load
  })

  const data = customers.data
  const total = data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const updating = customers.isFetching && customers.isPlaceholderData

  return (
    <>
      <PageHeader
        title="Customers"
        description="The cafes you sell to, with Tax ID and Payment Terms."
        action={
          canEdit ? (
            <Button asChild size="lg">
              <Link to="/customers/new">
                <Plus aria-hidden="true" />
                New customer
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Label htmlFor="customer-search" className="mb-1.5 block">
            Search customers
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="customer-search"
              type="search"
              className="pl-9"
              placeholder="Part of the name, or the Tax ID"
              autoComplete="off"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
            {updating ? (
              <Loader2
                className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
                aria-label="Searching"
              />
            ) : null}
          </div>
        </div>
        <div className="sm:w-44">
          <Label htmlFor="customer-filter" className="mb-1.5 block">
            Show
          </Label>
          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value as ActiveFilter)
              setPage(1)
            }}
          >
            <SelectTrigger id="customer-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {customers.isError ? (
        <ErrorAlert error={customers.error} onRetry={() => void customers.refetch()} className="mb-4" />
      ) : null}

      {customers.isError && !data ? null : (
        <div className={cn('transition-opacity', updating && 'opacity-60')} aria-busy={updating}>
          <DataTable
            caption="Customers"
            columns={columns}
            rows={data?.items}
            isLoading={customers.isPending}
            getRowKey={(c) => c.id}
            getRowHref={(c) => `/customers/${c.id}`}
            empty={(() => {
              const message = emptyListMessage(q, filter)
              return (
                <EmptyState
                  icon={Users}
                  title={message.title}
                  description={message.description}
                  action={
                    canEdit && !q && filter !== 'inactive' ? (
                      <Button asChild>
                        <Link to="/customers/new">New customer</Link>
                      </Button>
                    ) : null
                  }
                />
              )
            })()}
          />
        </div>
      )}

      {data && total > 0 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
          <p className="tabular text-sm text-muted-foreground" aria-live="polite">
            {pagerLabel(data.page, data.page_size, total)}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft aria-hidden="true" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            >
              Next
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      ) : null}
    </>
  )
}
