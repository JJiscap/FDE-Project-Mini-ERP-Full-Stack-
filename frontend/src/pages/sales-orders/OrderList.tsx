import { useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FileText, Loader2, Plus, Search } from 'lucide-react'
import { useCurrentUser } from '@/auth/useMe'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { canEditSalesOrders } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import {
  PAGE_SIZE,
  emptyListMessage,
  pagerLabel,
  useDebouncedValue,
  type OrderListItem,
  type OrderPage,
  type StatusFilter,
} from './helpers'

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const columns: Column<OrderListItem>[] = [
  { header: 'Order', isTitle: true, cell: (o) => <span className="tabular font-medium">{o.number}</span> },
  { header: 'Date', cell: (o) => formatDate(o.order_date) },
  { header: 'Customer', cell: (o) => <span className="break-words">{o.customer.name}</span> },
  { header: 'Status', cell: (o) => <StatusBadge status={o.status} /> },
  { header: 'Total', align: 'right', cell: (o) => <Money value={o.total} strong /> },
]

/** The Sales Orders list: status filter, search by number or Customer, pager. */
export function OrderList() {
  const me = useCurrentUser()
  const canEdit = canEditSalesOrders(me.role)

  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebouncedValue(search.trim(), 300)

  const orders = useQuery({
    queryKey: ['sales-orders', 'list', { q, status, page }],
    queryFn: ({ signal }) =>
      api.get<OrderPage>(
        '/sales-orders',
        { q, status: status === 'all' ? undefined : status, page, page_size: PAGE_SIZE },
        signal,
      ),
    placeholderData: keepPreviousData,
  })

  const data = orders.data
  const total = data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const updating = orders.isFetching && orders.isPlaceholderData

  const newOrderButton = (
    <Button asChild size="lg">
      <Link to="/sales-orders/new">
        <Plus aria-hidden="true" />
        New order
      </Link>
    </Button>
  )

  return (
    <>
      <PageHeader
        title="Sales Orders"
        description="Write an order for a Customer, confirm it, and the Invoice is issued."
        action={canEdit ? newOrderButton : null}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <Label htmlFor="order-search" className="mb-1.5 block">
            Search orders
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="order-search"
              type="search"
              className="pl-9"
              placeholder="Order number or Customer name"
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
                role="img"
                aria-label="Searching"
              />
            ) : null}
          </div>
        </div>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              variant={status === f.value ? 'default' : 'outline'}
              aria-pressed={status === f.value}
              onClick={() => {
                setStatus(f.value)
                setPage(1)
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {orders.isError ? (
        <ErrorAlert error={orders.error} onRetry={() => void orders.refetch()} className="mb-4" />
      ) : null}

      {orders.isError && !data ? null : (
        <div className={cn('transition-opacity', updating && 'opacity-60')} aria-busy={updating}>
          <DataTable
            caption="Sales Orders"
            columns={columns}
            rows={data?.items}
            isLoading={orders.isPending}
            getRowKey={(o) => o.id}
            getRowHref={(o) => `/sales-orders/${o.id}`}
            empty={(() => {
              const message = emptyListMessage(q, status)
              return (
                <EmptyState
                  icon={FileText}
                  title={message.title}
                  description={message.description}
                  action={canEdit && !q && status === 'all' ? newOrderButton : null}
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
