import { ReceiptText } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

// STUB: the invoices ticket replaces this file. Only edit inside src/pages/invoices/.
export default function InvoicesPage() {
  return (
    <>
      <PageHeader title="Invoices" description="Every Invoice issued, with its Balance and status." />
      <EmptyState
        icon={ReceiptText}
        title="Coming soon"
        description="Invoices will appear here once they are built."
      />
    </>
  )
}
