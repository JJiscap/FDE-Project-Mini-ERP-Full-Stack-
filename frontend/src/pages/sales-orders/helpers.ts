import { useEffect, useState } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { formatQty, formatTHB } from '@/lib/format'

// ---------------------------------------------------------------- API shapes

export type OrderStatus = 'draft' | 'confirmed' | 'cancelled'
export type StatusFilter = 'all' | OrderStatus

export interface OrderListItem {
  id: number
  number: string
  order_date: string
  status: OrderStatus
  customer: { id: number; name: string }
  line_count: number
  subtotal: string
  vat: string
  total: string
}

export interface OrderPage {
  items: OrderListItem[]
  total: number
  page: number
  page_size: number
}

export interface OrderLine {
  id: number
  product_id: number
  sku: string
  name: string
  unit: string
  quantity: number
  unit_price: string
  amount: string
  on_hand: number
}

/** `GET /api/sales-orders/{id}`. `invoice` is null until the order is Confirmed (ticket 09). */
export interface OrderDetail {
  id: number
  number: string
  order_date: string
  status: OrderStatus
  confirmed_at: string | null
  customer: { id: number; name: string; tax_id: string; payment_terms_days: number }
  lines: OrderLine[]
  subtotal: string
  vat: string
  total: string
  invoice: { id: number; number: string } | null
}

/** A Customer as the picker needs it (`GET /api/customers`). */
export interface CustomerChoice {
  id: number
  name: string
  tax_id: string
  payment_terms_days: number
}

/** A Product as the picker needs it (`GET /api/products`). */
export interface ProductChoice {
  id: number
  sku: string
  name: string
  unit: string
  price: string
  on_hand: number
  active: boolean
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export const PAGE_SIZE = 20

/** Query key of one order. Ids from the URL are strings, so always go through this. */
export const orderKey = (id: string | number) => ['sales-orders', 'detail', String(id)] as const

/** After any change the API answers with the whole updated order: keep it, and refresh the lists. */
export function cacheOrder(queryClient: QueryClient, order: OrderDetail): void {
  queryClient.setQueryData(orderKey(order.id), order)
  void queryClient.invalidateQueries({ queryKey: ['sales-orders', 'list'] })
}

// --------------------------------------------------------------------- money
// The browser shows live totals before the order is saved. It counts in whole satang
// (1/100 THB) so no float ever touches money, and it follows the server's rule:
// VAT = 7% of the whole Subtotal, rounded half up to 2 decimals (app.core.money.vat_for).
// Once an order is saved, the totals on screen are the server's.

const PRICE = /^(\d+)(?:\.(\d{1,2}))?$/

function toSatang(price: string): number {
  const match = PRICE.exec(price.trim())
  if (!match) return 0
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

function fromSatang(satang: number): string {
  const whole = Math.floor(satang / 100)
  return `${whole}.${String(satang % 100).padStart(2, '0')}`
}

/** quantity x unit price, as a money string: `lineAmount(20, '450.00')` is `'9000.00'`. */
export function lineAmount(quantity: number, unitPrice: string): string {
  return fromSatang(quantity * toSatang(unitPrice))
}

export interface Totals {
  subtotal: string
  vat: string
  total: string
}

export function computeTotals(lines: { quantity: number; unit_price: string }[]): Totals {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * toSatang(line.unit_price), 0)
  const vat = Math.floor((subtotal * 7 + 50) / 100) // half up
  return { subtotal: fromSatang(subtotal), vat: fromSatang(vat), total: fromSatang(subtotal + vat) }
}

// ------------------------------------------------------------------ quantity

export const MAX_QUANTITY = 1_000_000

export type QuantityResult = { ok: true; value: number } | { ok: false; message: string }

/** Checks a typed quantity the way the server will: a whole number above 0. */
export function parseQuantity(text: string): QuantityResult {
  const t = text.trim()
  if (t === '') return { ok: false, message: 'Enter a quantity' }
  if (!/^-?\d+$/.test(t)) return { ok: false, message: 'Quantity must be a whole number' }
  const value = Number(t)
  if (value <= 0) return { ok: false, message: 'Quantity must be greater than 0' }
  if (value > MAX_QUANTITY) return { ok: false, message: `Quantity must be ${MAX_QUANTITY.toLocaleString('en-US')} or less` }
  return { ok: true, value }
}

/** A hint for Sales, never a block: the server checks stock when the order is Confirmed. */
export function stockWarning(quantity: number, onHand: number, unit: string): string | null {
  return quantity > onHand ? `Only ${formatQty(onHand, unit)} on hand` : null
}

// ------------------------------------------------------- lines before saving

export interface DraftLine {
  product_id: number
  sku: string
  name: string
  unit: string
  unit_price: string
  on_hand: number
  quantity: number
}

/** Adds a Product; one already on the order gets its quantity increased (no duplicate line). */
export function addDraftLine(lines: DraftLine[], product: ProductChoice, quantity: number): DraftLine[] {
  if (lines.some((l) => l.product_id === product.id)) {
    return lines.map((l) => (l.product_id === product.id ? { ...l, quantity: l.quantity + quantity } : l))
  }
  return [
    ...lines,
    {
      product_id: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      unit_price: product.price,
      on_hand: product.on_hand,
      quantity,
    },
  ]
}

export function setDraftQuantity(lines: DraftLine[], productId: number, quantity: number): DraftLine[] {
  return lines.map((l) => (l.product_id === productId ? { ...l, quantity } : l))
}

export function removeDraftLine(lines: DraftLine[], productId: number): DraftLine[] {
  return lines.filter((l) => l.product_id !== productId)
}

// -------------------------------------------------------------------- labels

/** "ARB-1KG · Arabica, 1 kg bag · 450.00 THB · 170 kg on hand" */
export function productLabel(p: ProductChoice): string {
  return `${p.sku} · ${p.name} · ${formatTHB(p.price)} · ${formatQty(p.on_hand, p.unit)} on hand`
}

/** 0 days is Cash. */
export function paymentTermsText(days: number): string {
  if (days === 0) return 'Cash'
  return days === 1 ? '1 day' : `${days} days`
}

/** "1–20 of 45" */
export function pagerLabel(page: number, pageSize: number, total: number): string {
  if (total === 0) return '0 of 0'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return `${start}–${end} of ${total}`
}

export function emptyListMessage(q: string, status: StatusFilter): { title: string; description: string } {
  const search = q.trim()
  if (search) {
    return {
      title: `No sales orders match '${search}'`,
      description: 'Check the spelling, or search by order number or Customer name.',
    }
  }
  if (status === 'draft') {
    return { title: 'No draft sales orders', description: 'Orders you are still writing will be listed here.' }
  }
  if (status === 'confirmed') {
    return { title: 'No confirmed sales orders', description: 'Confirmed orders are final and have an Invoice.' }
  }
  if (status === 'cancelled') {
    return { title: 'No cancelled sales orders', description: 'A cancelled Draft keeps its number and is listed here.' }
  }
  return { title: 'No sales orders yet', description: 'Create the first order for a Customer to start selling.' }
}

/** The value, but only after it stopped changing for `delay` ms (search as you type). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
