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

vi.mock('@/auth/useMe', () => ({
  useMe: () => ({
    data: { id: '1', email: 'nok@siambean.test', full_name: 'Nok', role: 'sales', company: { id: 1, name: 'Siam Bean Co.' } },
  }),
  useCurrentUser: () => ({
    id: '1',
    email: 'nok@siambean.test',
    full_name: 'Nok',
    role: 'sales',
    company: { id: 1, name: 'Siam Bean Co.' },
  }),
}))

import { NewOrder } from './NewOrder'
import { OrderDetail } from './OrderDetail'
import { OrderList } from './OrderList'
import type { OrderDetail as Order } from './helpers'

const lune = { id: 7, name: 'Café Lune', tax_id: '0105561000011', payment_terms_days: 30 }
const brew = { id: 8, name: 'Brew Lab Ari', tax_id: '0105562000022', payment_terms_days: 0 }
const arb = { id: 1, sku: 'ARB-1KG', name: 'Arabica, 1 kg bag', unit: 'kg', price: '450.00', on_hand: 170, active: true }
const rob = { id: 2, sku: 'ROB-1KG', name: 'Robusta, 1 kg bag', unit: 'kg', price: '320.00', on_hand: 35, active: true }

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, page_size: 20 }
}

function draft(overrides: Partial<Order> = {}): Order {
  return {
    id: 12,
    number: 'SO-0001',
    order_date: '2026-10-22',
    status: 'draft',
    confirmed_at: null,
    customer: lune,
    lines: [
      {
        id: 31,
        product_id: 1,
        sku: 'ARB-1KG',
        name: 'Arabica, 1 kg bag',
        unit: 'kg',
        quantity: 20,
        unit_price: '450.00',
        amount: '9000.00',
        on_hand: 170,
      },
    ],
    subtotal: '9000.00',
    vat: '630.00',
    total: '9630.00',
    invoice: null,
    ...overrides,
  }
}

type Call = { method: string; url: string; body: unknown }

/** A fake API: `handlers` maps "METHOD /path" to the JSON to answer (a function gets the body). */
function fakeApi(handlers: Record<string, unknown | ((body: unknown) => { status?: number; json: unknown })>) {
  const calls: Call[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, url: url.pathname + url.search, body })
    const key = `${method} ${url.pathname}`
    if (!(key in handlers)) return new Response(JSON.stringify({ detail: `no fake for ${key}` }), { status: 500 })
    const handler = handlers[key]
    const answer = typeof handler === 'function' ? (handler as (b: unknown) => { status?: number; json: unknown })(body) : { json: handler }
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
          <Route path="/sales-orders" element={<OrderList />} />
          <Route path="/sales-orders/new" element={<NewOrder />} />
          <Route path="/sales-orders/:id" element={<OrderDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('New order', () => {
  it('Nok picks a Customer, adds 20 kg of ARB-1KG, sees the live totals and saves a Draft', async () => {
    const calls = fakeApi({
      'GET /api/customers': page([lune, brew]),
      'GET /api/products': page([arb, rob]),
      'POST /api/sales-orders': () => ({ status: 201, json: draft() }),
      'GET /api/sales-orders/12': draft(),
    })
    renderAt('/sales-orders/new')

    // 1. Customer: the search asks for active Customers only
    fireEvent.click(await screen.findByRole('button', { name: /Café Lune/ }))
    expect(await screen.findByTestId('chosen-customer')).toHaveTextContent('Café Lune')
    expect(calls.some((c) => c.url.startsWith('/api/customers?') && c.url.includes('active=true'))).toBe(true)

    // 2. Product: shown with price and On Hand
    fireEvent.click(await screen.findByRole('button', { name: 'ARB-1KG · Arabica, 1 kg bag · 450.00 THB · 170 kg on hand' }))
    const quantity = screen.getByLabelText(/Quantity \(kg\)/)
    fireEvent.change(quantity, { target: { value: '20' } })
    expect(screen.queryByText(/Only 170 kg on hand/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Add to order/ }))

    // 3. Live line amount and totals
    const lines = await screen.findByRole('list', { name: 'Order lines' })
    expect(within(lines).getByText('9,000.00 THB')).toBeInTheDocument()
    expect(screen.getByTestId('subtotal')).toHaveTextContent('9,000.00 THB')
    expect(screen.getByTestId('vat')).toHaveTextContent('630.00 THB')
    expect(screen.getByTestId('total')).toHaveTextContent('9,630.00 THB')

    // 4. Save as Draft sends the Customer and the lines, never a price
    fireEvent.click(screen.getByRole('button', { name: /Save as Draft/ }))
    expect(await screen.findByText('SO-0001', { selector: 'h1' })).toBeInTheDocument()
    const post = calls.find((c) => c.method === 'POST')
    expect(post?.url).toBe('/api/sales-orders')
    expect(post?.body).toEqual({ customer_id: 7, lines: [{ product_id: 1, quantity: 20 }] })
  })

  it('warns, but does not block, when the quantity is more than On Hand', async () => {
    fakeApi({ 'GET /api/customers': page([lune]), 'GET /api/products': page([arb]) })
    renderAt('/sales-orders/new')

    fireEvent.click(await screen.findByRole('button', { name: /ARB-1KG/ }))
    fireEvent.change(screen.getByLabelText(/Quantity \(kg\)/), { target: { value: '200' } })

    expect(screen.getByText(/Only 170 kg on hand/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Add to order/ }))
    const lines = await screen.findByRole('list', { name: 'Order lines' })
    expect(within(lines).getByText('Only 170 kg on hand')).toBeInTheDocument()
    expect(screen.getByTestId('subtotal')).toHaveTextContent('90,000.00 THB')
  })

  it('refuses quantity 0 with the same message as the server and adds nothing', async () => {
    fakeApi({ 'GET /api/customers': page([lune]), 'GET /api/products': page([arb]) })
    renderAt('/sales-orders/new')

    fireEvent.click(await screen.findByRole('button', { name: /ARB-1KG/ }))
    fireEvent.change(screen.getByLabelText(/Quantity \(kg\)/), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /Add to order/ }))

    expect(await screen.findByText('Quantity must be greater than 0')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Order lines' })).not.toBeInTheDocument()
  })

  it('adding the same Product twice adds to one line', async () => {
    fakeApi({ 'GET /api/customers': page([lune]), 'GET /api/products': page([arb]) })
    renderAt('/sales-orders/new')

    for (const value of ['5', '7']) {
      fireEvent.click(await screen.findByRole('button', { name: /^ARB-1KG · Arabica/ }))
      fireEvent.change(screen.getByLabelText(/Quantity \(kg\)/), { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: /Add to order/ }))
      await screen.findByRole('list', { name: 'Order lines' })
    }

    const lines = screen.getByRole('list', { name: 'Order lines' })
    expect(within(lines).getAllByRole('listitem')).toHaveLength(1)
    expect(within(lines).getByLabelText('Quantity of ARB-1KG')).toHaveValue('12')
    expect(screen.getByTestId('subtotal')).toHaveTextContent('5,400.00 THB')
  })

  it('cannot be saved without a Customer, and shows the API reason when saving fails', async () => {
    fakeApi({
      'GET /api/customers': page([lune]),
      'GET /api/products': page([arb]),
      'POST /api/sales-orders': () => ({ status: 409, json: { detail: 'Café Lune is deactivated' } }),
    })
    renderAt('/sales-orders/new')

    const save = await screen.findByRole('button', { name: /Save as Draft/ })
    expect(save).toBeDisabled()
    expect(screen.getByText('Choose a customer to save the order.')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /Café Lune/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Save as Draft/ })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /Save as Draft/ }))

    expect(await screen.findByText('Café Lune is deactivated')).toBeInTheDocument()
  })
})

describe('Order detail', () => {
  it('a Draft shows its lines and totals with the editing controls and Cancel order', async () => {
    fakeApi({ 'GET /api/sales-orders/12': draft(), 'GET /api/customers': page([lune]), 'GET /api/products': page([arb]) })
    renderAt('/sales-orders/12')

    expect(await screen.findByRole('heading', { level: 1, name: 'SO-0001' })).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity of ARB-1KG')).toHaveValue('20')
    expect(screen.getByTestId('total')).toHaveTextContent('9,630.00 THB')
    expect(screen.getByRole('button', { name: 'Remove ARB-1KG' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change customer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel order/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Add a product' })).toBeInTheDocument()
  })

  it('changing a quantity sends only the quantity and shows the server totals (the price stays 450.00)', async () => {
    const after = draft({
      lines: [{ ...draft().lines[0], quantity: 30, amount: '13500.00' }],
      subtotal: '13500.00',
      vat: '945.00',
      total: '14445.00',
    })
    const calls = fakeApi({
      'GET /api/sales-orders/12': draft(),
      'PATCH /api/sales-orders/12/lines/31': () => ({ json: after }),
      'GET /api/products': page([arb]),
    })
    renderAt('/sales-orders/12')

    const input = await screen.findByLabelText('Quantity of ARB-1KG')
    fireEvent.change(input, { target: { value: '30' } })
    fireEvent.blur(input)

    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('14,445.00 THB'))
    const patch = calls.find((c) => c.method === 'PATCH')
    expect(patch?.body).toEqual({ quantity: 30 })
    expect(screen.getByText('450.00 THB per kg')).toBeInTheDocument()
  })

  it('shows the API reason when an edit is refused', async () => {
    fakeApi({
      'GET /api/sales-orders/12': draft(),
      'PATCH /api/sales-orders/12/lines/31': () => ({ status: 409, json: { detail: "SO-0001 is cancelled and can't be changed" } }),
      'GET /api/products': page([arb]),
    })
    renderAt('/sales-orders/12')

    const input = await screen.findByLabelText('Quantity of ARB-1KG')
    fireEvent.change(input, { target: { value: '30' } })
    fireEvent.blur(input)

    expect(await screen.findByText("SO-0001 is cancelled and can't be changed")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Quantity of ARB-1KG')).toHaveValue('20'))
  })

  it('removing a line calls DELETE and the empty order says so', async () => {
    const empty = draft({ lines: [], subtotal: '0.00', vat: '0.00', total: '0.00' })
    const calls = fakeApi({
      'GET /api/sales-orders/12': draft(),
      'DELETE /api/sales-orders/12/lines/31': () => ({ json: empty }),
      'GET /api/products': page([arb]),
    })
    renderAt('/sales-orders/12')

    fireEvent.click(await screen.findByRole('button', { name: 'Remove ARB-1KG' }))

    expect(await screen.findByText(/No products on this order yet/)).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/sales-orders/12/lines/31')).toBe(true)
    expect(screen.getByTestId('total')).toHaveTextContent('0.00 THB')
  })

  it('cancelling asks first, then marks the order Cancelled and read-only', async () => {
    const cancelled = draft({ status: 'cancelled' })
    const calls = fakeApi({
      'GET /api/sales-orders/12': draft(),
      'POST /api/sales-orders/12/cancel': () => ({ json: cancelled }),
      'GET /api/products': page([arb]),
    })
    renderAt('/sales-orders/12')

    fireEvent.click(await screen.findByRole('button', { name: /Cancel order/ }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Cancel SO-0001?')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST')).toBe(false) // nothing sent yet

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }))

    await waitFor(() => expect(screen.getByText(/This order was cancelled/)).toBeInTheDocument())
    expect(screen.queryByLabelText('Quantity of ARB-1KG')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancel order/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Add a product' })).not.toBeInTheDocument()
  })

  it.each([
    ['cancelled', /This order was cancelled/],
    ['confirmed', /This order is final/],
  ] as const)('a %s order is read-only', async (status, message) => {
    fakeApi({
      'GET /api/sales-orders/12': draft({
        status,
        confirmed_at: status === 'confirmed' ? '2026-10-22T10:00:00Z' : null,
        invoice: status === 'confirmed' ? { id: 5, number: 'INV-0001' } : null,
      }),
    })
    renderAt('/sales-orders/12')

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByLabelText('Quantity of ARB-1KG')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove ARB-1KG' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change customer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancel order/ })).not.toBeInTheDocument()
    expect(screen.getByText('20 kg')).toBeInTheDocument()
    expect(screen.getByTestId('total')).toHaveTextContent('9,630.00 THB')
  })

  it('changing the Customer sends only the new customer_id', async () => {
    const calls = fakeApi({
      'GET /api/sales-orders/12': draft(),
      'PATCH /api/sales-orders/12': () => ({ json: draft({ customer: brew }) }),
      'GET /api/customers': page([lune, brew]),
      'GET /api/products': page([arb]),
    })
    renderAt('/sales-orders/12')

    fireEvent.click(await screen.findByRole('button', { name: 'Change customer' }))
    fireEvent.click(await screen.findByRole('button', { name: /Brew Lab Ari/ }))

    await waitFor(() => expect(screen.getByTestId('chosen-customer')).toHaveTextContent('Brew Lab Ari'))
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ customer_id: 8 })
  })
})

describe('Confirm order (US-1)', () => {
  const confirmedOrder = () =>
    draft({
      status: 'confirmed',
      confirmed_at: '2026-10-22T10:00:00Z',
      invoice: { id: 5, number: 'INV-0001' },
      lines: [{ ...draft().lines[0], on_hand: 150 }],
    })

  it('shows a primary "Confirm order" button on a Draft; clicking it asks first and shows the Total', async () => {
    const calls = fakeApi({
      'GET /api/sales-orders/12': draft(),
      'GET /api/customers': page([lune]),
      'GET /api/products': page([arb]),
    })
    renderAt('/sales-orders/12')

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm order' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Confirm SO-0001?')).toBeInTheDocument()
    expect(dialog).toHaveTextContent('9,630.00 THB')
    expect(dialog).toHaveTextContent('Café Lune')
    expect(dialog).toHaveTextContent("can't be undone")
    expect(calls.some((c) => c.method === 'POST')).toBe(false) // nothing sent yet

    fireEvent.click(within(dialog).getByRole('button', { name: 'Go back' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('confirming sends one POST, then shows Confirmed, the Invoice number as a link, and a read-only order', async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries')
    const calls = fakeApi({
      'GET /api/sales-orders/12': draft(),
      'POST /api/sales-orders/12/confirm': () => ({ json: confirmedOrder() }),
      'GET /api/customers': page([lune]),
      'GET /api/products': page([arb]),
    })
    renderAt('/sales-orders/12')

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm order' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm order' }))

    const link = await screen.findByRole('link', { name: /INV-0001/ })
    expect(link).toHaveAttribute('href', '/invoices/5')
    expect(calls.filter((c) => c.method === 'POST')).toEqual([
      { method: 'POST', url: '/api/sales-orders/12/confirm', body: undefined },
    ])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText(/This order is final/)).toBeInTheDocument()
    expect(screen.getByText('Confirmed', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm order' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancel order/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Quantity of ARB-1KG')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove ARB-1KG' })).not.toBeInTheDocument()
    expect(screen.getByTestId('total')).toHaveTextContent('9,630.00 THB')

    // Stock, the product lists, Invoices and the Dashboard all changed: they refresh.
    const keys = invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey))
    for (const key of ['["stock"]', '["products"]', '["invoices"]', '["dashboard"]']) {
      expect(keys).toContain(key)
    }
  })

  it('shows the API reason inside the dialog when stock is short, and the order stays a Draft', async () => {
    fakeApi({
      'GET /api/sales-orders/12': draft(),
      'POST /api/sales-orders/12/confirm': () => ({ status: 409, json: { detail: 'Not enough stock for ARB-1KG' } }),
      'GET /api/customers': page([lune]),
      'GET /api/products': page([arb]),
    })
    renderAt('/sales-orders/12')

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm order' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm order' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Not enough stock for ARB-1KG')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument() // stays open so the message is read

    fireEvent.click(within(dialog).getByRole('button', { name: 'Go back' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity of ARB-1KG')).toHaveValue('20') // still editable
    expect(screen.queryByRole('link', { name: /INV-/ })).not.toBeInTheDocument()

    // Asking again starts clean: the old message is gone.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm order' }))
    const again = await screen.findByRole('alertdialog')
    expect(within(again).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a Draft with no lines cannot be confirmed and says why', async () => {
    fakeApi({
      'GET /api/sales-orders/12': draft({ lines: [], subtotal: '0.00', vat: '0.00', total: '0.00' }),
      'GET /api/customers': page([lune]),
      'GET /api/products': page([arb]),
    })
    renderAt('/sales-orders/12')

    expect(await screen.findByRole('button', { name: 'Confirm order' })).toBeDisabled()
    expect(screen.getByText('Add at least one product to confirm.')).toBeInTheDocument()
  })

  it('a Confirmed order links to its Invoice and offers no Confirm or Cancel', async () => {
    fakeApi({ 'GET /api/sales-orders/12': confirmedOrder() })
    renderAt('/sales-orders/12')

    const link = await screen.findByRole('link', { name: /INV-0001/ })
    expect(link).toHaveAttribute('href', '/invoices/5')
    expect(screen.queryByRole('button', { name: 'Confirm order' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancel order/ })).not.toBeInTheDocument()
  })

  it('a Cancelled order has no Confirm button', async () => {
    fakeApi({ 'GET /api/sales-orders/12': draft({ status: 'cancelled' }) })
    renderAt('/sales-orders/12')

    expect(await screen.findByText(/This order was cancelled/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm order' })).not.toBeInTheDocument()
  })
})

describe('Order list', () => {
  const rows = [
    { id: 2, number: 'SO-0002', order_date: '2026-10-22', status: 'draft', customer: { id: 8, name: 'Brew Lab Ari' }, line_count: 0, subtotal: '0.00', vat: '0.00', total: '0.00' },
    { id: 1, number: 'SO-0001', order_date: '2026-10-21', status: 'confirmed', customer: { id: 7, name: 'Café Lune' }, line_count: 1, subtotal: '9000.00', vat: '630.00', total: '9630.00' },
  ]

  it('lists orders with status and Total, and filters by status', async () => {
    const calls = fakeApi({ 'GET /api/sales-orders': page(rows) })
    renderAt('/sales-orders')

    expect((await screen.findAllByText('SO-0001')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('9,630.00 THB').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /New order/ })).toHaveAttribute('href', '/sales-orders/new')

    fireEvent.click(screen.getByRole('button', { name: 'Draft' }))
    await waitFor(() => expect(calls.some((c) => c.url.includes('status=draft'))).toBe(true))
  })

  it('shows "No sales orders yet" when there are none', async () => {
    fakeApi({ 'GET /api/sales-orders': page([]) })
    renderAt('/sales-orders')

    expect(await screen.findByText('No sales orders yet')).toBeInTheDocument()
  })
})
