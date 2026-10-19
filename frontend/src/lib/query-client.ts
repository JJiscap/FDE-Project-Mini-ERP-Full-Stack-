import { QueryClient } from '@tanstack/react-query'
import { isApiError, isForbidden } from '@/lib/api'

/**
 * One QueryClient for the app.
 * - A 403 is thrown to the nearest AccessBoundary, which shows the Access denied page.
 * - 4xx answers are not retried: they will not change by asking again.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && failureCount < 2,
      throwOnError: isForbidden,
    },
    mutations: {
      throwOnError: isForbidden,
    },
  },
})
