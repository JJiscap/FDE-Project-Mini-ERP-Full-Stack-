import { Users } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

// STUB: the customers ticket replaces this file. Only edit inside src/pages/customers/.
export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" description="The cafes you sell to, with Tax ID and Payment Terms." />
      <EmptyState
        icon={Users}
        title="Coming soon"
        description="The customer list will appear here once it is built."
      />
    </>
  )
}
