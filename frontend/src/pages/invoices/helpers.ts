import { useEffect, useState } from 'react'
import type { QueryClient } from '@tanstack/react-query'

// ---------------------------------------------------------------- API shapes
// Money is always a string with 2 decimals ("9630.00"); format it with formatTHB / <Money />.

export type InvoiceStatus = 'open' | 'paid'
/** "Overdue" is a filter, not a status: an Open Invoice whose Due Date has passed. */
export type InvoiceFilter = 'all' | 'open' | 'overdue' | 'paid'

/** One row of `GET /api/invoices` and of `GET /api/accounting/receivables`. */
export interface InvoiceSummary {
  id: number
  number: string
  invoice_date: string
  due_date: string
  customer: { id: number; name: string }
  total: string
  paid: string
  balance: string
  status: InvoiceStatus
  overdue: boolean
  days_overdue: number
}

export interface InvoicePage {
  items: InvoiceSummary[]
  total: number
  page: number
  page_size: number
}

/** `GET /api/accounting/receivables`: the totals cover every Open Invoice, not just this page. */
export interface ReceivablesPage extends InvoicePage {
  open_receivables: string
  overdue_count: number
  overdue_receivables: string
}

export interface InvoiceLine {
  id: number
  sku: string
  name: string
  unit: string
  quantity: number
  unit_price: string
  amount: string
}

export type PaymentMethod = 'transfer' | 'cash' | 'cheque'

export interface Payment {
  id: number
  amount: string
  paid_on: string
  method: PaymentMethod
  note: string | null
  recorded_by: string | null
  created_at: string
}

/** `GET /api/invoices/{id}`, and the answer to `POST /api/invoices/{id}/payments`. */
export interface InvoiceDetail {
  id: number
  number: string
  invoice_date: string
  due_date: string
  status: InvoiceStatus
  overdue: boolean
  days_overdue: number
  customer: { id: number; name: string; tax_id: string; address: string | null; payment_terms_days: number }
  order: { id: number; number: string }
  lines: InvoiceLine[]
  subtotal: string
  vat: string
  total: string
  paid: string
  balance: string
  payments: Payment[]
}

export const PAGE_SIZE = 20

// --------------------------------------------------------------- query keys

/** Query key of one Invoice. Ids from the URL are strings, so always go through this. */
export const invoiceKey = (id: string | number) => ['invoices', 'detail', String(id)] as const

/** A Payment changes the Invoice, the Accounting screen, and the Dashboard's Open Invoices. */
const REFRESHED_AFTER_PAYMENT = [['invoices'], ['accounting'], ['dashboard']] as const

/** After a Payment the API answers with the whole updated Invoice: keep it, and refresh what depends on it. */
export function cacheInvoice(queryClient: QueryClient, invoice: InvoiceDetail): void {
  queryClient.setQueryData(invoiceKey(invoice.id), invoice)
  refreshAfterPayment(queryClient)
}

/** Also used when the server refused (someone else may have paid): the screens then show the current Balance. */
export function refreshAfterPayment(queryClient: QueryClient): void {
  for (const queryKey of REFRESHED_AFTER_PAYMENT) void queryClient.invalidateQueries({ queryKey })
}

// ---------------------------------------------------------------- wording

export function overdueLabel(days: number): string {
  return `Overdue by ${days} ${days === 1 ? 'day' : 'days'}`
}

export function pagerLabel(page: number, pageSize: number, total: number): string {
  if (total === 0) return '0 of 0'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return `${start}–${end} of ${total}`
}

export function emptyListMessage(q: string, filter: InvoiceFilter): { title: string; description: string } {
  const search = q.trim()
  if (search) {
    return {
      title: `No invoices match '${search}'`,
      description: 'Check the spelling, or search by Invoice number or Customer name.',
    }
  }
  if (filter === 'open') {
    return { title: 'No open invoices', description: 'Every Invoice has been paid.' }
  }
  if (filter === 'overdue') {
    return { title: 'No overdue invoices', description: 'No Open Invoice is past its Due Date.' }
  }
  if (filter === 'paid') {
    return { title: 'No paid invoices', description: 'An Invoice is listed here once its Balance reaches 0.00 THB.' }
  }
  return {
    title: 'No invoices yet',
    description: 'An Invoice is issued when Sales confirm a Sales Order.',
  }
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
