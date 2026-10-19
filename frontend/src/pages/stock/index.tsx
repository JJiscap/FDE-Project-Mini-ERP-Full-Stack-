import { Boxes } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

// STUB: the stock ticket replaces this file. Only edit inside src/pages/stock/.
export default function StockPage() {
  return (
    <>
      <PageHeader title="Stock" description="Stock-in, Stock-out, Adjustments and movement history." />
      <EmptyState
        icon={Boxes}
        title="Coming soon"
        description="Stock movements will appear here once they are built."
      />
    </>
  )
}
