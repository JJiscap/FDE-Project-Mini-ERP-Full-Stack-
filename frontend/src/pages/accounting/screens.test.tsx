import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  useCurrentUser: () => ({
    id: '1',
    email: 'fon@siambean.test',
    full_name: 'Fon',
    role: 'accountant',
    company: { id: 1, name: 'Siam Bean Co.' },
  }),
}))

import { todayInBangkok } from '@/lib/format'
import AccountingPage from './index'

const lune = { id: 7, name: 'Café Lune' }
const brew = { id: 8, name: 'Brew Lab Ari' }

function invoice(overrides: Record<string, unknown> = {}) {
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

function receivables(items: ReturnType<typeof invoice>[], totals: Record<string, unknown> = {}) {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 20,
    open_receivables: '0.00',
    overdue_count: 0,
    overdue_receivables: '0.00',
    ...totals,
  }
}

const OVERDUE = invoice({
  id: 6,
  number: 'INV-0002',
  invoice_date: '2026-09-06',
  due_date: '2026-10-06',
  customer: brew,
  total: '9630.00',
  paid: '5000.00',
  balance: '4630.00',
  overdue: true,
  days_overdue: 15,
})
const FRESH = invoice()

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

function renderAccounting() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/accounting']}>
        <AccountingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const TWO_OPEN = receivables([OVERDUE, FRESH], {
  open_receivables: '14260.00',
  overdue_count: 1,
  overdue_receivables: '4630.00',
})

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function openPaymentDialog(number: string) {
  fireEvent.click((await screen.findAllByRole('button', { name: `Record payment for ${number}` }))[0])
  return screen.findByRole('dialog')
}

describe('Accounting: Open Receivables', () => {
  it('shows the Open Receivables total, the Overdue part, and Open Invoices with Balances, Overdue first', async () => {
    fakeApi({ 'GET /api/accounting/receivables': TWO_OPEN })
    renderAccounting()

    expect(await screen.findByRole('heading', { level: 1, name: 'Accounting' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('open-receivables')).toHaveTextContent('14,260.00 THB'))
    expect(screen.getByTestId('overdue-receivables')).toHaveTextContent('4,630.00 THB')

    const links = screen.getAllByRole('link', { name: /INV-000/ })
    expect(links.map((l) => l.textContent)).toEqual(['INV-0002', 'INV-0001', 'INV-0002', 'INV-0001']) // the table, then the phone cards
    expect(links[0]).toHaveAttribute('href', '/invoices/6')
    expect(screen.getAllByText('Brew Lab Ari').length).toBeGreaterThan(0)
    expect(screen.getAllByText('4,630.00 THB').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Overdue by 15 days').length).toBeGreaterThan(0)
  })

  it('asks the API for the receivables (not the Invoice list) and sends the search', async () => {
    const calls = fakeApi({ 'GET /api/accounting/receivables': TWO_OPEN })
    renderAccounting()
    await screen.findAllByText('INV-0002')

    fireEvent.change(screen.getByLabelText('Search open invoices'), { target: { value: 'lune' } })

    await waitFor(() => expect(calls.some((c) => c.url.includes('q=lune'))).toBe(true), { timeout: 3000 })
    expect(calls.every((c) => c.url.startsWith('/api/accounting/receivables'))).toBe(true)
  })

  it('shows an empty state when nobody owes anything', async () => {
    fakeApi({ 'GET /api/accounting/receivables': receivables([]) })
    renderAccounting()

    expect(await screen.findByText('No open invoices')).toBeInTheDocument()
    expect(screen.getByTestId('open-receivables')).toHaveTextContent('0.00 THB')
  })

  it("shows the API's message when the receivables cannot be loaded", async () => {
    fakeApi({ 'GET /api/accounting/receivables': () => ({ status: 500, json: { detail: 'Database is busy' } }) })
    renderAccounting()

    expect(await screen.findByRole('alert')).toHaveTextContent('Database is busy')
  })
})

describe('Record payment (US-4)', () => {
  it('opens a dialog whose amount defaults to the Balance, today (Bangkok), transfer and no note', async () => {
    fakeApi({ 'GET /api/accounting/receivables': TWO_OPEN })
    renderAccounting()

    const dialog = await openPaymentDialog('INV-0001')

    expect(within(dialog).getByText('Record payment for INV-0001')).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Café Lune')
    expect(dialog).toHaveTextContent('9,630.00 THB')
    expect(within(dialog).getByLabelText(/^Amount/)).toHaveValue('9630.00')
    expect(within(dialog).getByLabelText('Payment date')).toHaveValue(todayInBangkok())
    expect(within(dialog).getByRole('radio', { name: 'Bank transfer' })).toBeChecked()
    expect(within(dialog).getByLabelText(/^Note/)).toHaveValue('')
    expect(dialog).toHaveTextContent('The Invoice will be marked Paid')
  })

  it('records the full Balance with one POST, closes, and refreshes receivables, Invoices and the Dashboard', async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    let paid = false
    const calls = fakeApi({
      'GET /api/accounting/receivables': () => ({
        json: paid ? receivables([OVERDUE], { open_receivables: '4630.00' }) : TWO_OPEN,
      }),
      'POST /api/invoices/5/payments': () => {
        paid = true
        return { status: 201, json: { ...FRESH, status: 'paid', paid: '9630.00', balance: '0.00', payments: [] } }
      },
    })
    renderAccounting()

    const dialog = await openPaymentDialog('INV-0001')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls.filter((c) => c.method === 'POST')).toEqual([
      {
        method: 'POST',
        url: '/api/invoices/5/payments',
        body: { amount: '9630.00', paid_on: todayInBangkok(), method: 'transfer', note: null },
      },
    ])
    await waitFor(() => expect(screen.queryByText('INV-0001')).not.toBeInTheDocument()) // no longer owed
    const keys = invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
    for (const key of ['["accounting"]', '["invoices"]', '["dashboard"]']) expect(keys).toContain(key)
  })

  it('a partial Payment shows the Balance after it, and sends the chosen method, date and note', async () => {
    const calls = fakeApi({
      'GET /api/accounting/receivables': TWO_OPEN,
      'POST /api/invoices/5/payments': () => ({
        status: 201,
        json: { ...FRESH, paid: '5000.00', balance: '4630.00', payments: [] },
      }),
    })
    renderAccounting()
    const dialog = await openPaymentDialog('INV-0001')

    fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '5000' } })
    expect(dialog).toHaveTextContent('Balance after this payment: 4,630.00 THB')
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Cash' }))
    fireEvent.change(within(dialog).getByLabelText('Payment date'), { target: { value: '2026-10-19' } })
    fireEvent.change(within(dialog).getByLabelText(/^Note/), { target: { value: 'Cash at the counter' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      amount: '5000.00',
      paid_on: '2026-10-19',
      method: 'cash',
      note: 'Cash at the counter',
    })
  })

  it('refuses more than the Balance before sending, naming the Balance', async () => {
    const calls = fakeApi({ 'GET /api/accounting/receivables': TWO_OPEN })
    renderAccounting()
    const dialog = await openPaymentDialog('INV-0002')
    expect(within(dialog).getByLabelText(/^Amount/)).toHaveValue('4630.00')

    fireEvent.change(within(dialog).getByLabelText(/^Amount/), { target: { value: '4631.00' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))

    expect(await within(dialog).findByText('Payment is more than the balance of 4,630.00 THB')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('refuses an empty, zero or negative amount before sending', async () => {
    const calls = fakeApi({ 'GET /api/accounting/receivables': TWO_OPEN })
    renderAccounting()
    const dialog = await openPaymentDialog('INV-0001')
    const amount = within(dialog).getByLabelText(/^Amount/)
    const submit = within(dialog).getByRole('button', { name: 'Record payment' })

    fireEvent.change(amount, { target: { value: '' } })
    fireEvent.click(submit)
    expect(await within(dialog).findByText('Amount is required')).toBeInTheDocument()

    fireEvent.change(amount, { target: { value: '0' } })
    fireEvent.click(submit)
    expect(await within(dialog).findByText('Amount must be greater than 0')).toBeInTheDocument()

    fireEvent.change(amount, { target: { value: '-5' } })
    fireEvent.click(submit)
    expect(await within(dialog).findByText('Amount must be greater than 0')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it("shows the API's reason inside the dialog when the server refuses, and keeps the dialog open", async () => {
    fakeApi({
      'GET /api/accounting/receivables': TWO_OPEN,
      'POST /api/invoices/5/payments': () => ({ status: 409, json: { detail: 'INV-0001 is already paid' } }),
    })
    renderAccounting()
    const dialog = await openPaymentDialog('INV-0001')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('INV-0001 is already paid')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Go back closes the dialog without sending anything', async () => {
    const calls = fakeApi({ 'GET /api/accounting/receivables': TWO_OPEN })
    renderAccounting()
    const dialog = await openPaymentDialog('INV-0001')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Go back' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })
})
