import { formatQty } from '@/lib/format'

export type MovementType = 'in' | 'out' | 'adjust'

/** A Product as the Stock screen's picker sees it (GET /api/stock/products). */
export interface StockProduct {
  id: number
  sku: string
  name: string
  unit: string
  on_hand: number
  reorder_level: number
  low_stock: boolean
}

export interface RecordedMovement {
  id: number
  product_id: number
  created_at: string
  movement_type: string
  ref_doc: string
  quantity: number
  reason: string | null
  on_hand: number
}

export interface HistoryItem {
  id: number
  created_at: string
  movement_type: string
  ref_doc: string | null
  quantity: number
  reason: string | null
  balance_after: number
  created_by_name: string | null
}

export interface HistoryPage {
  items: HistoryItem[]
  total: number
  page: number
  page_size: number
}

export type QuantityResult = { ok: true; value: number } | { ok: false; message: string }

/**
 * Checks the typed quantity the way the server will: whole, not 0, and positive for
 * a Stock-in or Stock-out. An Adjustment is signed (-3 removes, 4 adds).
 */
export function parseQuantity(raw: string, type: MovementType): QuantityResult {
  const text = raw.trim()
  if (text === '') return { ok: false, message: 'Enter a quantity' }
  if (!/^[+-]?\d+$/.test(text)) return { ok: false, message: 'Quantity must be a whole number' }
  const value = Number(text)
  if (value === 0) return { ok: false, message: "Quantity can't be 0" }
  if (type !== 'adjust' && value < 0) return { ok: false, message: 'Quantity must be greater than 0' }
  return { ok: true, value }
}

/** `ARB-1KG · Arabica, 1 kg bag · 170 kg` */
export function productLabel(product: StockProduct): string {
  return `${product.sku} · ${product.name} · ${formatQty(product.on_hand, product.unit)}`
}

const TYPE_LABELS: Record<string, string> = {
  in: 'Stock-in',
  out: 'Stock-out',
  adjust: 'Adjustment',
  opening: 'Opening Stock',
  sale: 'Sale',
}

export function movementLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

/** `+30 kg`, `-3 kg`: the stored quantity with its sign. */
export function signedQty(quantity: number, unit: string): string {
  return `${quantity > 0 ? '+' : ''}${formatQty(quantity, unit)}`
}

/** `IN-0001 recorded: ARB-1KG now 200 kg` */
export function successMessage(refDoc: string, product: StockProduct, onHand: number): string {
  return `${refDoc} recorded: ${product.sku} now ${formatQty(onHand, product.unit)}`
}
