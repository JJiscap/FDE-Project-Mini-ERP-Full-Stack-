import { formatTHB } from '@/lib/format'
import type { PaymentMethod } from '@/pages/invoices/helpers'

// Money here is counted in whole satang (1/100 THB) so no float ever touches it. These checks are a
// convenience: the server is the authority and its message is shown as is.

export type { PaymentMethod }

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
]

export function methodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method
}

export type AmountResult = { ok: true; value: string } | { ok: false; message: string }

const TYPED = /^(-?)(\d*)(?:\.(\d*))?$/
const MONEY = /^(-?)(\d+)(?:\.(\d{1,2}))?$/
const MAX_WHOLE_DIGITS = 10 // numeric(12,2)

function satangOf(money: string): number {
  const match = MONEY.exec(money.trim())
  if (!match) return 0
  const satang = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'))
  return match[1] ? -satang : satang
}

function moneyOf(satang: number): string {
  const sign = satang < 0 ? '-' : ''
  const abs = Math.abs(satang)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/**
 * Read what the Accountant typed ("9630", "9,630.00", "0.5") into exact money ("9630.00").
 * With the `balance`, a Payment above it is refused, naming the Balance (the server says the same).
 */
export function parseAmount(text: string, balance?: string): AmountResult {
  const typed = text.trim().replace(/,/g, '')
  if (typed === '') return { ok: false, message: 'Amount is required' }
  const match = TYPED.exec(typed)
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) {
    return { ok: false, message: 'Amount must be a number' }
  }
  const [, sign, whole, decimals = ''] = match
  if (decimals.length > 2) return { ok: false, message: 'Amount can have at most 2 decimal places' }
  if (whole.replace(/^0+/, '').length > MAX_WHOLE_DIGITS) return { ok: false, message: 'Amount is too large' }
  const satang = Number(whole || '0') * 100 + Number(decimals.padEnd(2, '0'))
  if (sign || satang === 0) return { ok: false, message: 'Amount must be greater than 0' }
  if (balance !== undefined && satang > satangOf(balance)) {
    return { ok: false, message: `Payment is more than the balance of ${formatTHB(balance)}` }
  }
  return { ok: true, value: moneyOf(satang) }
}

/** What would still be owed after paying `amount`: `balanceAfter('9630.00', '5000.00')` is `'4630.00'`. */
export function balanceAfter(balance: string, amount: string): string {
  return moneyOf(satangOf(balance) - satangOf(amount))
}

export interface PaymentFormValues {
  amount: string
  paid_on: string
  method: PaymentMethod
  note: string
}

export interface PaymentBody {
  amount: string
  paid_on: string
  method: PaymentMethod
  note: string | null
}

/** The request body of `POST /api/invoices/{id}/payments`. */
export function paymentBody(values: PaymentFormValues): PaymentBody {
  return {
    amount: values.amount,
    paid_on: values.paid_on,
    method: values.method,
    note: values.note.trim() === '' ? null : values.note.trim(),
  }
}

/** The toast after a Payment: Paid, or what is still owed. */
export function successMessage(invoiceNumber: string, amount: string, balance: string): string {
  const recorded = `Payment of ${formatTHB(amount)} recorded`
  return satangOf(balance) === 0
    ? `${recorded}. ${invoiceNumber} is Paid.`
    : `${recorded} on ${invoiceNumber}. Balance ${formatTHB(balance)}.`
}
