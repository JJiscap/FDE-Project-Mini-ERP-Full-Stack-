import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatDateTime, formatQty } from '@/lib/format'
import { cn } from '@/lib/utils'
import { movementLabel, signedQty, type HistoryItem, type HistoryPage, type StockProduct } from './helpers'

export function MovementHistory({ product }: { product: StockProduct | undefined }) {
  // The parent keys this component by Product, so the page starts at 1 for each one.
  const [page, setPage] = useState(1)

  const history = useQuery({
    queryKey: ['stock', 'history', { productId: product?.id, page }],
    queryFn: () => api.get<HistoryPage>('/stock/movements', { product_id: product?.id, page }),
    enabled: product !== undefined,
    placeholderData: keepPreviousData,
  })

  if (!product) {
    return (
      <EmptyState
        icon={History}
        title="Choose a Product"
        description="Pick a Product above to see every movement and the balance after each one."
      />
    )
  }
  if (history.isError) return <ErrorAlert error={history.error} onRetry={() => void history.refetch()} />

  const unit = product.unit
  const columns: Column<HistoryItem>[] = [
    { header: 'Document', cell: (m) => m.ref_doc ?? '-', isTitle: true, className: 'font-medium' },
    { header: 'Date', cell: (m) => formatDateTime(m.created_at), className: 'whitespace-nowrap' },
    { header: 'Type', cell: (m) => movementLabel(m.movement_type) },
    {
      header: 'Quantity',
      align: 'right',
      className: 'tabular whitespace-nowrap',
      cell: (m) => (
        <span className={cn(m.quantity < 0 && 'text-destructive')}>{signedQty(m.quantity, unit)}</span>
      ),
    },
    {
      header: 'Balance after',
      align: 'right',
      className: 'tabular whitespace-nowrap',
      cell: (m) => formatQty(m.balance_after, unit),
    },
    { header: 'Reason', cell: (m) => m.reason ?? '-', className: 'max-w-56 whitespace-normal break-words' },
    { header: 'By', cell: (m) => m.created_by_name ?? '-' },
  ]

  const data = history.data
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div className="space-y-3">
      <DataTable
        caption={`Movement history of ${product.sku}`}
        columns={columns}
        rows={data?.items}
        getRowKey={(m) => m.id}
        isLoading={history.isLoading}
        empty={<EmptyState icon={History} title="No movements yet" description={`Nothing recorded for ${product.sku}.`} />}
      />
      {data && data.total > data.page_size ? (
        <nav aria-label="History pages" className="flex items-center justify-between gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {pageCount}
          </span>
          <Button variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  )
}
