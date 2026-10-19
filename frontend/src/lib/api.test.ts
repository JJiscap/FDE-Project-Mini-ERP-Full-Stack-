import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()
const signOut = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: () => getSession(), signOut: () => signOut() } },
}))

import { api, ApiError } from './api'

function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn()

function unexpectedSuccess(): never {
  throw new Error('expected the request to fail')
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } })
  signOut.mockResolvedValue({ error: null })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('api', () => {
  it('calls /api with the bearer token and parses JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 1, name: 'Siam Bean Co.' }))

    const data = await api.get<{ id: number }>('/me')

    expect(data).toEqual({ id: 1, name: 'Siam Bean Co.' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/me')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-123')
  })

  it('builds the query string and skips empty values', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [] }))

    await api.get('/customers', { q: 'lune', page: 2, active: undefined, empty: '' })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/customers?q=lune&page=2')
  })

  it('sends a JSON body on POST', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'x' }))

    await api.post('/stock/movements', { product_id: 1, quantity: 20 })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ product_id: 1, quantity: 20 })
  })

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204))
    await expect(api.post('/x')).resolves.toBeUndefined()
  })

  it('throws ApiError with the detail message from the API', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { detail: 'Not enough stock for ARB-1KG' }))

    const err = await api.post('/sales-orders/1/confirm').then(unexpectedSuccess, (e: ApiError) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(409)
    expect(err.detail).toBe('Not enough stock for ARB-1KG')
    expect(err.message).toBe('Not enough stock for ARB-1KG')
  })

  it('flattens a list of validation errors into one readable message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, { detail: [{ loc: ['body', 'price'], msg: 'Price must be 0 or more' }] }),
    )

    const err = await api.post('/products', {}).then(unexpectedSuccess, (e: ApiError) => e)

    expect(err.detail).toBe('Price must be 0 or more')
  })

  it('signs out and reports 401 when the API says the token is not valid', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: 'Not authenticated' }))

    const err = await api.get('/products').then(unexpectedSuccess, (e: ApiError) => e)

    expect(err.status).toBe(401)
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('signs out without calling the API when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    const err = await api.get('/products').then(unexpectedSuccess, (e: ApiError) => e)

    expect(err.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('keeps the user signed in on 403 so the page can show Access denied', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { detail: 'Your role cannot do this' }))

    const err = await api.get('/accounting/receivables').then(unexpectedSuccess, (e: ApiError) => e)

    expect(err.status).toBe(403)
    expect(err.detail).toBe('Your role cannot do this')
    expect(signOut).not.toHaveBeenCalled()
  })

  it('gives a plain message when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const err = await api.get('/products').then(unexpectedSuccess, (e: ApiError) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(0)
    expect(err.detail).toMatch(/connection/i)
  })

  it('falls back to a readable message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }))

    const err = await api.get('/products').then(unexpectedSuccess, (e: ApiError) => e)

    expect(err.status).toBe(502)
    expect(err.detail).toMatch(/something went wrong/i)
  })
})
