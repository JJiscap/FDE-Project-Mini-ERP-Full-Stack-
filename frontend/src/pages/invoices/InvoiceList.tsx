import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2, ReceiptText, Search } from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  PAGE_SIZE,
  emptyListMessage,
  pagerLabel,
  useDebouncedValue,
  type InvoiceFilter,
  type InvoicePage,
  type InvoiceSummary,
} from './helpers'
import { InvoiceStatusBadges } from './InvoiceStatusBadges'

const FILTERS: { value: InvoiceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
]

const columns: Column<InvoiceSummary>[] = [
  { header: 'Invoice', isTitle: true, cell: (i) => <span className="tabular font-medium">{i.number}</span> },
  { header: 'Date', cell: (i) => formatDate(i.invoice_date) },
  { header: 'Customer', cell: (i) => <span className="break-words">{i.customer.name}</span> },
  { header: 'Total', align: 'right', cell: (i) => <Money value={i.total} /> },
  { header: 'Balance', align: 'right', cell: (i) => <Money value={i.balance} strong /> },
  { header: 'Status', cell: (i) => <InvoiceStatusBadges invoice={i} /> },
]

/** The Invoice list (Admin, Sales, Accountant): status filter, search by number or Customer, pager. */
export function InvoiceList() {
  const [filter, setFilter] = useState<InvoiceFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebouncedValue(search.trim(), 300)

  const invoices = useQuery({
    queryKey: ['invoices', 'list', { q, filter, page }],
    queryFn: ({ signal }) =>
      api.get<InvoicePage>(
        '/invoices',
        { q, status: filter === 'all' ? undefined : filter, page, page_size: PAGE_SIZE },
        signal,
      ),
    placeholderData: keepPreviousData,
  })

  const data = invoices.data
  const total = data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const updating = invoices.isFetching && invoices.isPlaceholderData

  return (
    <>
      <PageHeader title="Invoices" description="Every Invoice issued, with its Balance and status." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <Label htmlFor="invoice-search" className="mb-1.5 block">
            Search invoices
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="invoice-search"
              type="search"
              className="pl-9"
              placeholder="Invoice number or Customer name"
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
              variant={filter === f.value ? 'default' : 'outline'}
              aria-pressed={filter === f.value}
              onClick={() => {
                setFilter(f.value)
                setPage(1)
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {invoices.isError ? (
        <ErrorAlert error={invoices.error} onRetry={() => void invoices.refetch()} className="mb-4" />
      ) : null}

      {invoices.isError && !data ? null : (
        <div className={cn('transition-opacity', updating && 'opacity-60')} aria-busy={updating}>
          <DataTable
            caption="Invoices"
            columns={columns}
            rows={data?.items}
            isLoading={invoices.isPending}
            getRowKey={(i) => i.id}
            getRowHref={(i) => `/invoices/${i.id}`}
            empty={(() => {
              const message = emptyListMessage(q, filter)
              return <EmptyState icon={ReceiptText} title={message.title} description={message.description} />
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
            <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
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
