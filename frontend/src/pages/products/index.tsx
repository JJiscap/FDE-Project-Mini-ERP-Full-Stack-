import { Coffee } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

// STUB: the products ticket replaces this file. Only edit inside src/pages/products/.
export default function ProductsPage() {
  return (
    <>
      <PageHeader title="Products" description="What Siam Bean sells, with On Hand and Low Stock." />
      <EmptyState
        icon={Coffee}
        title="Coming soon"
        description="The product list will appear here once it is built."
      />
    </>
  )
}
