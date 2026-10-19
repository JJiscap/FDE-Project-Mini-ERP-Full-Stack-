import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Boxes } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PageHeader } from '@/components/PageHeader'
import { PageSpinner } from '@/components/PageSpinner'
import { api } from '@/lib/api'
import { MovementForm } from './MovementForm'
import { MovementHistory } from './MovementHistory'
import type { StockProduct } from './helpers'

export default function StockPage() {
  const [productId, setProductId] = useState('')
  const products = useQuery({
    queryKey: ['stock', 'products'],
    queryFn: () => api.get<StockProduct[]>('/stock/products'),
  })

  let body
  if (products.isLoading) {
    body = <PageSpinner />
  } else if (products.isError) {
    body = <ErrorAlert error={products.error} onRetry={() => void products.refetch()} />
  } else if (!products.data || products.data.length === 0) {
    body = (
      <EmptyState
        icon={Boxes}
        title="No Products yet"
        description="Ask the Admin to add a Product before recording stock."
      />
    )
  } else {
    const selected = products.data.find((p) => String(p.id) === productId)
    body = (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <MovementForm products={products.data} productId={productId} onProductChange={setProductId} />
        <section aria-labelledby="stock-history-title" className="min-w-0 space-y-3">
          <h2 id="stock-history-title" className="text-lg">
            Movement history{selected ? `: ${selected.sku}` : ''}
          </h2>
          <MovementHistory key={selected?.id ?? 'none'} product={selected} />
        </section>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Stock" description="Record a Stock-in, Stock-out or Adjustment and see why On Hand changed." />
      {body}
    </>
  )
}
