import { FileText } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

// STUB: the sales orders ticket replaces this file. Only edit inside src/pages/sales-orders/.
// It may render nested <Routes> for /sales-orders/new and /sales-orders/:id.
export default function SalesOrdersPage() {
  return (
    <>
      <PageHeader title="Sales Orders" description="Create an order, confirm it, and the Invoice is issued." />
      <EmptyState
        icon={FileText}
        title="Coming soon"
        description="Sales Orders will appear here once they are built."
      />
    </>
  )
}
