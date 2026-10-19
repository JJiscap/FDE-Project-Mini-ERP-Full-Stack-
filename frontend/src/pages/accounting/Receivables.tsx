import { useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, HandCoins, Landmark, Loader2, Search } from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { formatDate, formatTHB } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  PAGE_SIZE,
  emptyListMessage,
  overdueLabel,
  pagerLabel,
  useDebouncedValue,
  type InvoiceSummary,
  type ReceivablesPage,
} from '@/pages/invoices/helpers'
import { InvoiceStatusBadges } from '@/pages/invoices/InvoiceStatusBadges'
import { PaymentDialog } from './PaymentDialog'

function SummaryCard({
  label,
  testId,
  value,
  note,
  tone,
}: {
  label: string
  testId: string
  value: string | undefined
  note: string
  tone?: 'danger'
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <span
          data-testid={testId}
          className={cn('tabular block text-2xl font-semibold whitespace-nowrap', tone === 'danger' && 'text-danger')}
        >
          {value === undefined ? '-' : formatTHB(value)}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{note}</span>
      </dd>
    </div>
  )
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/**
 * The Accounting screen (Admin and Accountant): who still owes money. Open Invoices with their Balances,
 * the most overdue first, the Open Receivables total, and a "Record payment" button on every row.
 */
export function Receivables() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [paying, setPaying] = useState<InvoiceSummary | null>(null)
  const q = useDebouncedValue(search.trim(), 300)

  const receivables = useQuery({
    queryKey: ['accounting', 'receivables', { q, page }],
    queryFn: ({ signal }) =>
      api.get<ReceivablesPage>('/accounting/receivables', { q, page, page_size: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  })

  const data = receivables.data
  const total = data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const updating = receivables.isFetching && receivables.isPlaceholderData

  const columns: Column<InvoiceSummary>[] = [
    {
      header: 'Invoice',
      isTitle: true,
      cell: (i) => (
        <Link to={`/invoices/${i.id}`} className="tabular font-medium text-primary underline-offset-4 hover:underline">
          {i.number}
        </Link>
      ),
    },
    { header: 'Customer', cell: (i) => <span className="break-words">{i.customer.name}</span> },
    {
      header: 'Due date',
      cell: (i) => (
        <>
          <span>{formatDate(i.due_date)}</span>
          {i.overdue ? (
            <span className="block text-sm font-medium text-danger">{overdueLabel(i.days_overdue)}</span>
          ) : null}
        </>
      ),
    },
    { header: 'Status', cell: (i) => <InvoiceStatusBadges invoice={i} /> },
    { header: 'Total', align: 'right', cell: (i) => <Money value={i.total} /> },
    { header: 'Balance', align: 'right', cell: (i) => <Money value={i.balance} strong /> },
    {
      header: 'Payment',
      align: 'right',
      cell: (i) => (
        <Button
          type="button"
          variant="outline"
          className="w-full md:w-auto"
          aria-label={`Record payment for ${i.number}`}
          onClick={() => setPaying(i)}
        >
          <HandCoins aria-hidden="true" />
          Record payment
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Accounting"
        description="Open Invoices, who still owes money, and Payments. The most overdue come first."
      />

      <dl className="mb-6 grid gap-3 sm:grid-cols-2">
        <SummaryCard
          label="Open Receivables"
          testId="open-receivables"
          value={data?.open_receivables}
          note={data ? (q === '' ? plural(total, 'open invoice') : 'All Open Invoices, not just the search') : ' '}
        />
        <SummaryCard
          label="Overdue"
          testId="overdue-receivables"
          value={data?.overdue_receivables}
          tone={data && data.overdue_count > 0 ? 'danger' : undefined}
          note={data ? `${plural(data.overdue_count, 'invoice')} past the Due Date` : ' '}
        />
      </dl>

      <div className="mb-4">
        <Label htmlFor="receivables-search" className="mb-1.5 block">
          Search open invoices
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="receivables-search"
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

      {receivables.isError ? (
        <ErrorAlert error={receivables.error} onRetry={() => void receivables.refetch()} className="mb-4" />
      ) : null}

      {receivables.isError && !data ? null : (
        <div className={cn('transition-opacity', updating && 'opacity-60')} aria-busy={updating}>
          <DataTable
            caption="Open Invoices"
            columns={columns}
            rows={data?.items}
            isLoading={receivables.isPending}
            getRowKey={(i) => i.id}
            empty={(() => {
              const message = emptyListMessage(q, 'open')
              return <EmptyState icon={Landmark} title={message.title} description={message.description} />
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

      {paying ? <PaymentDialog key={paying.id} invoice={paying} onClose={() => setPaying(null)} /> : null}
    </>
  )
}
