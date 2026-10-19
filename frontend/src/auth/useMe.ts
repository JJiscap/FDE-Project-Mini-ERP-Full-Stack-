import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Role } from '@/lib/permissions'
import { useAuth } from '@/auth/AuthProvider'

/** `GET /api/me` */
export interface Me {
  id: string
  email: string
  full_name: string
  role: Role
  company: { id: number; name: string }
}

/**
 * The signed-in user with their Role and Company, from the API (not from Supabase).
 * A 403 here means "has a login but no Role": RequireAuth shows a friendly page.
 */
export function useMe() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['me', userId],
    queryFn: () => api.get<Me>('/me'),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    retry: false,
    throwOnError: false,
  })
}

/** For pages inside the app shell, where RequireAuth guarantees the user is loaded. */
export function useCurrentUser(): Me {
  const { data } = useMe()
  if (!data) throw new Error('useCurrentUser must be used inside the app shell')
  return data
}
