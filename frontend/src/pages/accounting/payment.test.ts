import { describe, expect, it } from 'vitest'
import { PAYMENT_METHODS, balanceAfter, parseAmount, paymentBody, successMessage } from './payment'

describe('parseAmount', () => {
  it('accepts a plain number, thousands separators and whole baht, and returns exact 2-decimal money', () => {
    expect(parseAmount('9630.00')).toEqual({ ok: true, value: '9630.00' })
    expect(parseAmount('9,630.00')).toEqual({ ok: true, value: '9630.00' })
    expect(parseAmount(' 5000 ')).toEqual({ ok: true, value: '5000.00' })
    expect(parseAmount('0.5')).toEqual({ ok: true, value: '0.50' })
    expect(parseAmount('0.01')).toEqual({ ok: true, value: '0.01' })
  })

  it('says what to fix when the amount is empty, not a number, zero or negative, or has too many decimals', () => {
    expect(parseAmount('')).toEqual({ ok: false, message: 'Amount is required' })
    expect(parseAmount('   ')).toEqual({ ok: false, message: 'Amount is required' })
    expect(parseAmount('abc')).toEqual({ ok: false, message: 'Amount must be a number' })
    expect(parseAmount('1e3')).toEqual({ ok: false, message: 'Amount must be a number' })
    expect(parseAmount('0')).toEqual({ ok: false, message: 'Amount must be greater than 0' })
    expect(parseAmount('0.00')).toEqual({ ok: false, message: 'Amount must be greater than 0' })
    expect(parseAmount('-5')).toEqual({ ok: false, message: 'Amount must be greater than 0' })
    expect(parseAmount('10.001')).toEqual({ ok: false, message: 'Amount can have at most 2 decimal places' })
  })

  it('refuses more than the Balance and names it, but accepts exactly the Balance', () => {
    expect(parseAmount('4631.00', '4630.00')).toEqual({
      ok: false,
      message: 'Payment is more than the balance of 4,630.00 THB',
    })
    expect(parseAmount('4630.01', '4630.00').ok).toBe(false)
    expect(parseAmount('4630.00', '4630.00')).toEqual({ ok: true, value: '4630.00' })
    expect(parseAmount('4,630', '4630.00')).toEqual({ ok: true, value: '4630.00' })
  })
})

describe('balanceAfter', () => {
  it('subtracts in whole satang, with no float error', () => {
    expect(balanceAfter('9630.00', '5000.00')).toBe('4630.00')
    expect(balanceAfter('9630.00', '9630.00')).toBe('0.00')
    expect(balanceAfter('0.30', '0.10')).toBe('0.20')
    expect(balanceAfter('9630.00', '0.01')).toBe('9629.99')
  })
})

describe('paymentBody', () => {
  it('sends the amount as an exact string, the date, the method and the trimmed note (null when blank)', () => {
    expect(
      paymentBody({ amount: '5000.00', paid_on: '2026-10-22', method: 'cash', note: '  Cash at the counter ' }),
    ).toEqual({
      amount: '5000.00',
      paid_on: '2026-10-22',
      method: 'cash',
      note: 'Cash at the counter',
    })
    expect(paymentBody({ amount: '1.00', paid_on: '2026-10-22', method: 'transfer', note: '   ' }).note).toBeNull()
  })
})

describe('successMessage', () => {
  it('says the Invoice is Paid after a full payment', () => {
    expect(successMessage('INV-0001', '9630.00', '0.00')).toBe('Payment of 9,630.00 THB recorded. INV-0001 is Paid.')
  })

  it('names the remaining Balance after a partial payment', () => {
    expect(successMessage('INV-0001', '5000.00', '4630.00')).toBe(
      'Payment of 5,000.00 THB recorded on INV-0001. Balance 4,630.00 THB.',
    )
  })
})

describe('PAYMENT_METHODS', () => {
  it('offers transfer first (the default), then cash and cheque, matching the API', () => {
    expect(PAYMENT_METHODS.map((m) => m.value)).toEqual(['transfer', 'cash', 'cheque'])
    expect(PAYMENT_METHODS.map((m) => m.label)).toEqual(['Bank transfer', 'Cash', 'Cheque'])
  })
})
