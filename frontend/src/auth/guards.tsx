import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { UserX } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { useMe } from '@/auth/useMe'
import { AccessDenied } from '@/components/AccessDenied'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { PageSpinner } from '@/components/PageSpinner'
import { Button } from '@/components/ui/button'
import { isForbidden } from '@/lib/api'
import { canAccess, type Screen } from '@/lib/permissions'

/**
 * Layout route for everything behind login.
 * - no session   -> /login (and back to this page after logging in)
 * - no Role (403 from /api/me) -> friendly page with Log out
 * - otherwise    -> renders the child routes
 */
export function RequireAuth() {
  const { session, signOut } = useAuth()
  const location = useLocation()
  const me = useMe()

  if (session === undefined) return <PageSpinner label="Opening Siam Bean ERP..." className="min-h-dvh" />
  if (session === null) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />

  if (me.isPending) return <PageSpinner label="Loading your account..." className="min-h-dvh" />

  if (me.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        {isForbidden(me.error) ? (
          <EmptyState
            icon={UserX}
            title="Your account has no role yet"
            description="You can log in, but the owner has not given you a role. Ask the owner to set one, then log in again."
            action={
              <Button size="lg" onClick={() => void signOut()}>
                Log out
              </Button>
            }
          />
        ) : (
          <ErrorAlert error={me.error} onRetry={() => void me.refetch()} />
        )}
      </div>
    )
  }

  return <Outlet />
}

/** Wraps one module page: shows Access denied when the Role may not open it. */
export function RequireScreen({ screen, children }: { screen: Screen; children: ReactNode }) {
  const { data: me } = useMe()
  if (!canAccess(me?.role, screen)) return <AccessDenied screen={screen} />
  return <>{children}</>
}
