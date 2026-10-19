import { render, screen } from '@testing-library/react'
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 't' } } }),
      signOut: vi.fn(),
    },
  },
}))

vi.mock('@/auth/useMe', () => ({
  useMe: () => ({
    data: { id: '1', email: 'nok@siambean.test', full_name: 'Nok', role: 'sales', company: { id: 1, name: 'Siam Bean Co.' } },
  }),
}))

import { AccessBoundary } from '@/components/AccessBoundary'
import { RequireScreen } from '@/auth/guards'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/query-client'

function Receivables() {
  const { data } = useQuery({ queryKey: ['receivables'], queryFn: () => api.get<{ total: string }>('/accounting/receivables') })
  return <p>Total {data?.total}</p>
}

function renderPage(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  queryClient.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('Access denied', () => {
  it('shows the Access denied page when the API answers 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Your role cannot do this' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    renderPage(
      <AccessBoundary resetKey="/accounting">
        <Receivables />
      </AccessBoundary>,
    )

    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/')
    vi.unstubAllGlobals()
  })

  it('shows Access denied for a screen the Role may not open, without calling the API', () => {
    renderPage(
      <RequireScreen screen="accounting">
        <p>Secret receivables</p>
      </RequireScreen>,
    )

    expect(screen.getByText('You do not have access to this page')).toBeInTheDocument()
    expect(screen.getByText(/Accounting is only open to Admin and Accountant/)).toBeInTheDocument()
    expect(screen.queryByText('Secret receivables')).not.toBeInTheDocument()
  })

  it('renders the page when the Role may open it', () => {
    renderPage(
      <RequireScreen screen="invoices">
        <p>Invoice list</p>
      </RequireScreen>,
    )
    expect(screen.getByText('Invoice list')).toBeInTheDocument()
  })
})
