/**
 * Display formatting. Every screen goes through these helpers, so money,
 * quantities and dates look the same everywhere.
 *
 * Money arrives from the API as strings like "9630.00" (numeric(12,2)). The
 * string is handed straight to Intl.NumberFormat so no float arithmetic happens.
 */

const EMPTY = '-'
export const BANGKOK_TZ = 'Asia/Bangkok'

const moneyFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const qtyFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

function isNumeric(value: unknown): value is number | string {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim() !== '' && Number.isFinite(Number(value))
  return false
}

/** Numeric strings stay strings, so Intl formats the exact decimal (no float rounding). */
function exact(value: number | string): number | `${number}` {
  return typeof value === 'string' ? (value.trim() as `${number}`) : value
}

/** `formatTHB("9630.00")` -> `9,630.00 THB` */
export function formatTHB(value: number | string | null | undefined): string {
  if (!isNumeric(value)) return EMPTY
  return `${moneyFormat.format(exact(value))} THB`
}

/** `formatQty(150, "kg")` -> `150 kg`. Quantities are whole numbers of units. */
export function formatQty(qty: number | string | null | undefined, unit: string): string {
  if (!isNumeric(qty)) return EMPTY
  return `${qtyFormat.format(exact(qty))} ${unit}`
}

const dateParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: BANGKOK_TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function partsOf(date: Date) {
  const map: Record<string, string> = {}
  for (const p of dateParts.formatToParts(date)) map[p.type] = p.value
  return map
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** `formatDate("2026-10-22")` -> `22 Oct 2026`. Timestamps are shown in Bangkok time. */
export function formatDate(value: string | Date | null | undefined): string {
  // A date-only value is a calendar day already: do not run it through a timezone.
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    if (m < 1 || m > 12) return EMPTY
    return `${d} ${MONTHS[m - 1]} ${y}`
  }
  const date = toDate(value)
  if (!date) return EMPTY
  const p = partsOf(date)
  return `${p.day} ${p.month} ${p.year}`
}

/** `formatDateTime("2026-10-22T10:00:00Z")` -> `22 Oct 2026, 17:00` (Bangkok). */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return EMPTY
  const p = partsOf(date)
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`
}

/** Today's calendar date in Bangkok as `YYYY-MM-DD` (for date inputs and "overdue" checks). */
export function todayInBangkok(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return parts
}
