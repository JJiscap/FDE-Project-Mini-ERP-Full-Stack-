import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 't' } } }),
      signOut: vi.fn(),
    },
  },
}))

const who = vi.hoisted(() => ({ role: 'accountant' }))
vi.mock('@/auth/useMe', () => ({
  useCurrentUser: () => ({
    id: '1',
    email: 'someone@siambean.test',
    full_name: 'Someone',
    role: who.role,
    company: { id: 1, name: 'Siam Bean Co.' },
  }),
}))

import { InvoiceDetail } from './InvoiceDetail'
import { InvoiceList } from './InvoiceList'

const lune = { id: 7, name: 'Café Lune' }

function summary(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    number: 'INV-0001',
    invoice_date: '2026-10-22',
    due_date: '2026-11-21',
    customer: lune,
    total: '9630.00',
    paid: '0.00',
    balance: '9630.00',
    status: 'open',
    overdue: false,
    days_overdue: 0,
    ...overrides,
  }
}

function page(items: unknown[]) {
  return { items, total: items.length, page: 1, page_size: 20 }
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    number: 'INV-0001',
    invoice_date: '2026-10-22',
    due_date: '2026-11-21',
    status: 'open',
    overdue: false,
    days_overdue: 0,
    customer: {
      id: 7,
      name: 'Café Lune',
      tax_id: '0105561000011',
      address: '88 Soi Ari 1, Phaya Thai, Bangkok 10400',
      payment_terms_days: 30,
    },
    order: { id: 12, number: 'SO-0001' },
    lines: [
      {
        id: 31,
        sku: 'ARB-1KG',
        name: 'Arabica, 1 kg bag',
        unit: 'kg',
        quantity: 20,
        unit_price: '450.00',
        amount: '9000.00',
      },
    ],
    subtotal: '9000.00',
    vat: '630.00',
    total: '9630.00',
    paid: '0.00',
    balance: '9630.00',
    payments: [],
    ...overrides,
  }
}

const PAID_PAYMENT = {
  id: 1,
  amount: '9630.00',
  paid_on: '2026-10-23',
  method: 'transfer',
  note: 'Slip 4471',
  recorded_by: 'Fon',
  created_at: '2026-10-23T03:00:00Z',
}

type Call = { method: string; url: string; body: unknown }
type Handler = unknown | ((body: unknown) => { status?: number; json: unknown })

/** A fake API: `handlers` maps "METHOD /path" to the JSON to answer (a function gets the body). */
function fakeApi(handlers: Record<string, Handler>) {
  const calls: Call[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, url: url.pathname + url.search, body })
    const key = `${method} ${url.pathname}`
    if (!(key in handlers)) return new Response(JSON.stringify({ detail: `no fake for ${key}` }), { status: 500 })
    const handler = handlers[key]
    const answer =
      typeof handler === 'function'
        ? (handler as (b: unknown) => { status?: number; json: unknown })(body)
        : { json: handler }
    return new Response(JSON.stringify(answer.json), {
      status: answer.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/invoices" element={<InvoiceList />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  who.role = 'accountant'
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Invoice list', () => {
  it('lists each Invoice with its number, Customer, Total, Balance and an Open badge, linking to the detail', async () => {
    fakeApi({ 'GET /api/invoices': page([summary()]) })
    renderAt('/invoices')

    const links = await screen.findAllByRole('link', { name: 'INV-0001' })
    expect(links[0]).toHaveAttribute('href', '/invoices/5')
    expect(screen.getAllByText('Café Lune').length).toBeGreaterThan(0)
    expect(screen.getAllByText('9,630.00 THB').length).toBeGreaterThan(0) // Total and Balance
    expect(screen.getAllByText('Open', { selector: 'span' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Overdue', { selector: 'span' })).not.toBeInTheDocument()
  })

  it('marks an Open Invoice past its Due Date with an Overdue badge next to Open, and a Paid one as Paid', async () => {
    fakeApi({
      'GET /api/invoices': page([
        summary({ id: 6, number: 'INV-0002', overdue: true, days_overdue: 15, due_date: '2026-10-06' }),
        summary({ id: 7, number: 'INV-0003', status: 'paid', paid: '9630.00', balance: '0.00' }),
      ]),
    })
    renderAt('/invoices')

    await screen.findAllByRole('link', { name: 'INV-0002' })
    expect(screen.getAllByText('Overdue', { selector: 'span' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Open', { selector: 'span' }).length).toBeGreaterThan(0) // still Open, and also Overdue
    expect(screen.getAllByText('Paid', { selector: 'span' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('0.00 THB').length).toBeGreaterThan(0)
  })

  it('shows an empty state with no Invoices yet', async () => {
    fakeApi({ 'GET /api/invoices': page([]) })
    renderAt('/invoices')

    expect(await screen.findByText('No invoices yet')).toBeInTheDocument()
  })

  it("shows the API's message when the list cannot be loaded", async () => {
    fakeApi({ 'GET /api/invoices': () => ({ status: 500, json: { detail: 'Database is busy' } }) })
    renderAt('/invoices')

    expect(await screen.findByRole('alert')).toHaveTextContent('Database is busy')
  })

  it('the Overdue filter and the search are sent to the API', async () => {
    const calls = fakeApi({ 'GET /api/invoices': page([summary()]) })
    renderAt('/invoices')
    await screen.findAllByRole('link', { name: 'INV-0001' })

    fireEvent.click(screen.getByRole('button', { name: 'Overdue' }))
    await waitFor(() => expect(calls.some((c) => c.url.includes('status=overdue'))).toBe(true))

    fireEvent.change(screen.getByLabelText('Search invoices'), { target: { value: 'lune' } })
    await waitFor(() => expect(calls.some((c) => c.url.includes('q=lune'))).toBe(true), { timeout: 3000 })
  })

  it('an empty search result says what was searched', async () => {
    fakeApi({ 'GET /api/invoices': page([]) })
    renderAt('/invoices')
    await screen.findByText('No invoices yet')

    fireEvent.change(screen.getByLabelText('Search invoices'), { target: { value: 'zzz' } })

    expect(await screen.findByText("No invoices match 'zzz'", undefined, { timeout: 3000 })).toBeInTheDocument()
  })
})

describe('Invoice detail', () => {
  it('shows the Customer with Tax ID, lines, Subtotal, VAT 7%, Total, Due Date, Balance and no Payments yet', async () => {
    fakeApi({ 'GET /api/invoices/5': detail() })
    renderAt('/invoices/5')

    expect(await screen.findByRole('heading', { level: 1, name: 'INV-0001' })).toBeInTheDocument()
    expect(screen.getByText('Café Lune')).toBeInTheDocument()
    expect(screen.getByText(/0105561000011/)).toBeInTheDocument()
    expect(screen.getByText(/88 Soi Ari 1/)).toBeInTheDocument()
    expect(screen.getAllByText('ARB-1KG').length).toBeGreaterThan(0)
    expect(screen.getAllByText('20 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('450.00 THB').length).toBeGreaterThan(0)
    expect(screen.getAllByText('9,000.00 THB').length).toBeGreaterThan(0) // the line amount
    expect(screen.getByTestId('subtotal')).toHaveTextContent('9,000.00 THB')
    expect(screen.getByTestId('vat')).toHaveTextContent('630.00 THB')
    expect(screen.getByTestId('total')).toHaveTextContent('9,630.00 THB')
    expect(screen.getByTestId('balance')).toHaveTextContent('9,630.00 THB')
    expect(screen.getByText(/VAT 7%/)).toBeInTheDocument()
    expect(screen.getByText(/21 Nov 2026/)).toBeInTheDocument() // the Due Date
    expect(screen.getByText('No payments yet')).toBeInTheDocument()
    expect(screen.getByText('Open', { selector: 'span' })).toBeInTheDocument()
  })

  it('the Accountant can record a Payment from here and the Sales Order is plain text for them', async () => {
    fakeApi({ 'GET /api/invoices/5': detail() })
    renderAt('/invoices/5')

    expect(await screen.findByRole('button', { name: 'Record payment' })).toBeInTheDocument()
    expect(screen.getByText('SO-0001')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'SO-0001' })).not.toBeInTheDocument() // the Accountant cannot open Sales Orders
  })

  it('Sales sees the Invoice and a link back to the Sales Order, but no Record payment button', async () => {
    who.role = 'sales'
    fakeApi({ 'GET /api/invoices/5': detail() })
    renderAt('/invoices/5')

    const link = await screen.findByRole('link', { name: 'SO-0001' })
    expect(link).toHaveAttribute('href', '/sales-orders/12')
    expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument()
  })

  it('a Paid Invoice shows its Payments, a zero Balance and no Record payment button', async () => {
    fakeApi({
      'GET /api/invoices/5': detail({ status: 'paid', paid: '9630.00', balance: '0.00', payments: [PAID_PAYMENT] }),
    })
    renderAt('/invoices/5')

    await screen.findByRole('heading', { level: 1, name: 'INV-0001' })
    expect(screen.getByText('Paid', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByTestId('balance')).toHaveTextContent('0.00 THB')
    expect(screen.getByTestId('paid')).toHaveTextContent('9,630.00 THB')
    expect(screen.getAllByText('Bank transfer').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Slip 4471').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Fon').length).toBeGreaterThan(0)
    expect(screen.getAllByText('23 Oct 2026').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument()
    expect(screen.queryByText('No payments yet')).not.toBeInTheDocument()
  })

  it('an Overdue Invoice says how many days late it is', async () => {
    fakeApi({ 'GET /api/invoices/5': detail({ overdue: true, days_overdue: 15, due_date: '2026-10-06' }) })
    renderAt('/invoices/5')

    expect(await screen.findByText(/Overdue by 15 days/)).toBeInTheDocument()
    expect(screen.getByText('Overdue', { selector: 'span' })).toBeInTheDocument()
  })

  it('recording the full Balance from the detail turns the screen to Paid', async () => {
    const paid = detail({ status: 'paid', paid: '9630.00', balance: '0.00', payments: [PAID_PAYMENT] })
    let recorded = false
    const calls = fakeApi({
      'GET /api/invoices/5': () => ({ json: recorded ? paid : detail() }),
      'POST /api/invoices/5/payments': () => {
        recorded = true
        return { status: 201, json: paid }
      },
    })
    renderAt('/invoices/5')

    fireEvent.click(await screen.findByRole('button', { name: 'Record payment' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/^Amount/)).toHaveValue('9630.00')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByTestId('balance')).toHaveTextContent('0.00 THB')
    expect(screen.getByText('Paid', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument()
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })

  it("shows the API's message for an Invoice that does not exist", async () => {
    fakeApi({ 'GET /api/invoices/999': () => ({ status: 404, json: { detail: 'Invoice not found' } }) })
    renderAt('/invoices/999')

    expect(await screen.findByRole('alert')).toHaveTextContent('Invoice not found')
    expect(screen.getByRole('link', { name: /Invoices/ })).toHaveAttribute('href', '/invoices')
  })
})
