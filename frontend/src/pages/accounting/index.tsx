import { Landmark } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

// STUB: the accounting ticket replaces this file. Only edit inside src/pages/accounting/.
export default function AccountingPage() {
  return (
    <>
      <PageHeader title="Accounting" description="Open Invoices, who still owes money, and Payments." />
      <EmptyState
        icon={Landmark}
        title="Coming soon"
        description="Open Receivables will appear here once they are built."
      />
    </>
  )
}
