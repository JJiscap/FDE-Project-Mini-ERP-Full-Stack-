import { LayoutDashboard } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

// STUB: the dashboard ticket replaces this file. Only edit inside src/pages/dashboard/.
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Sales today, low stock and what customers still owe." />
      <EmptyState
        icon={LayoutDashboard}
        title="Coming soon"
        description="The live numbers will appear here once the dashboard is built."
      />
    </>
  )
}
