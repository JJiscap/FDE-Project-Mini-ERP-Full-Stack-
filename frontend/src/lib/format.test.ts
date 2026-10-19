import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatQty, formatTHB, todayInBangkok } from './format'

// Expected values come from docs/scenario.md (US-1: 20 kg x 450 THB + 7% VAT = 9,630 THB).
describe('formatTHB', () => {
  it('formats a number as money with two decimals and THB', () => {
    expect(formatTHB(9630)).toBe('9,630.00 THB')
  })

  it('formats the API money string', () => {
    expect(formatTHB('9630.00')).toBe('9,630.00 THB')
  })

  it('shows the invoice parts from US-1', () => {
    expect(formatTHB('9000.00')).toBe('9,000.00 THB')
    expect(formatTHB('630.00')).toBe('630.00 THB')
  })

  it('groups thousands and keeps two decimals for stock value', () => {
    expect(formatTHB('107100')).toBe('107,100.00 THB')
    expect(formatTHB(0.5)).toBe('0.50 THB')
    expect(formatTHB(0)).toBe('0.00 THB')
  })

  it('rounds to two decimals', () => {
    expect(formatTHB('10.005')).toBe('10.01 THB')
  })

  it('shows negative money with a minus sign', () => {
    expect(formatTHB(-1250)).toBe('-1,250.00 THB')
  })

  it('shows a dash for a missing or invalid value', () => {
    expect(formatTHB(null)).toBe('-')
    expect(formatTHB(undefined)).toBe('-')
    expect(formatTHB('')).toBe('-')
    expect(formatTHB('abc')).toBe('-')
  })
})

describe('formatQty', () => {
  it('shows the quantity with its unit', () => {
    expect(formatQty(150, 'kg')).toBe('150 kg')
    expect(formatQty(240, 'box')).toBe('240 box')
  })

  it('groups thousands', () => {
    expect(formatQty(1240, 'kg')).toBe('1,240 kg')
  })

  it('accepts a numeric string and a negative movement', () => {
    expect(formatQty('35', 'kg')).toBe('35 kg')
    expect(formatQty(-20, 'kg')).toBe('-20 kg')
  })

  it('shows a dash for a missing quantity', () => {
    expect(formatQty(null, 'kg')).toBe('-')
  })
})

describe('Bangkok dates', () => {
  it('formats a date-only string without shifting the day', () => {
    expect(formatDate('2026-10-22')).toBe('22 Oct 2026')
  })

  it('moves a UTC evening into the next Bangkok day (UTC+7)', () => {
    expect(formatDate('2026-10-21T18:30:00Z')).toBe('22 Oct 2026')
  })

  it('formats date and time in Bangkok time', () => {
    expect(formatDateTime('2026-10-22T10:00:00Z')).toBe('22 Oct 2026, 17:00')
  })

  it('shows a dash for a missing or invalid date', () => {
    expect(formatDate(null)).toBe('-')
    expect(formatDate('not a date')).toBe('-')
  })

  it('returns today in Bangkok as YYYY-MM-DD', () => {
    expect(todayInBangkok(new Date('2026-10-21T18:30:00Z'))).toBe('2026-10-22')
    expect(todayInBangkok(new Date('2026-10-22T16:59:00Z'))).toBe('2026-10-22')
    expect(todayInBangkok(new Date('2026-10-22T17:00:00Z'))).toBe('2026-10-23')
  })
})
