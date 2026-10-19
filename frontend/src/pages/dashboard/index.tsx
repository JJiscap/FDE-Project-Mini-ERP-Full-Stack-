import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from '@/auth/useMe'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PageHeader } from '@/components/PageHeader'
import { api } from '@/lib/api'
import { DashboardTiles, type DashboardData } from './DashboardTiles'
import { greetingFor, updatedAtText } from './model'

const REFRESH_MS = 30_000

export default function DashboardPage() {
  const me = useCurrentUser()
  // Live numbers: fresh on every focus and every 30 s, so a Confirm made in another tab shows up here.
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/dashboard'),
    staleTime: 0,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: 'always',
  })

  return (
    <>
      <PageHeader title={`${greetingFor()}, ${me.full_name}`} description={me.company.name} />
      {dashboard.isError ? (
        <ErrorAlert error={dashboard.error} onRetry={() => void dashboard.refetch()} className="mb-4" />
      ) : null}
      <DashboardTiles data={dashboard.data} role={me.role} />
      {dashboard.dataUpdatedAt ? (
        <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
          {updatedAtText(new Date(dashboard.dataUpdatedAt))}
        </p>
      ) : null}
    </>
  )
}
