import { supabase } from '@/lib/supabase'

/**
 * The one way to talk to the backend. It adds the user's token, parses JSON and
 * turns every failure into an ApiError whose `detail` is safe to show to people.
 *
 *   401 -> we sign the user out (the route guard then shows /login)
 *   403 -> ApiError(403): pages show the Access denied page (see AccessBoundary)
 */

export class ApiError extends Error {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError
export const isForbidden = (e: unknown): boolean => isApiError(e) && e.status === 403

type Query = Record<string, string | number | boolean | null | undefined>

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  query?: Query
  body?: unknown
  signal?: AbortSignal
}

const GENERIC_ERROR = 'Something went wrong. Please try again.'
const OFFLINE_ERROR = 'Cannot reach the server. Check your internet connection and try again.'

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return `/api${path.startsWith('/') ? path : `/${path}`}${qs ? `?${qs}` : ''}`
}

/** The API answers `{"detail": "<message>"}`; FastAPI's own validation answers a list. */
function readDetail(body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((d) => (typeof d === 'string' ? d : (d as { msg?: unknown })?.msg))
      .filter((m): m is string => typeof m === 'string' && m.length > 0)
    if (messages.length > 0) return messages.join('. ')
  }
  return GENERIC_ERROR
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    await supabase.auth.signOut()
    throw new ApiError(401, 'Your session has ended. Please log in again.')
  }

  const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${token}` })
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, OFFLINE_ERROR)
  }

  if (response.status === 204) return undefined as T

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    if (response.status === 401) await supabase.auth.signOut()
    throw new ApiError(response.status, readDetail(payload))
  }
  return payload as T
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
