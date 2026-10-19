import { describe, expect, it } from 'vitest'
import { greetingFor, openInvoicesHref, openInvoicesText, updatedAtText } from './model'

describe('greetingFor', () => {
  it('uses Bangkok time, not the browser zone', () => {
    // 02:00 UTC = 09:00 in Bangkok
    expect(greetingFor(new Date('2026-10-22T02:00:00Z'))).toBe('Good morning')
    // 06:00 UTC = 13:00 in Bangkok
    expect(greetingFor(new Date('2026-10-22T06:00:00Z'))).toBe('Good afternoon')
    // 12:00 UTC = 19:00 in Bangkok
    expect(greetingFor(new Date('2026-10-22T12:00:00Z'))).toBe('Good evening')
    // 20:00 UTC = 03:00 next day in Bangkok
    expect(greetingFor(new Date('2026-10-21T20:00:00Z'))).toBe('Good morning')
  })
})

describe('openInvoicesHref', () => {
  it('goes to Accounting when the Role may see it', () => {
    expect(openInvoicesHref('accountant')).toBe('/accounting')
    expect(openInvoicesHref('admin')).toBe('/accounting')
  })
  it('falls back to Invoices, then to no link', () => {
    expect(openInvoicesHref('sales')).toBe('/invoices')
    expect(openInvoicesHref('warehouse')).toBeNull()
  })
})

describe('openInvoicesText', () => {
  it('reads "1 invoice · 9,630.00 THB"', () => {
    expect(openInvoicesText({ count: 1, amount: '9630.00' })).toBe('1 invoice · 9,630.00 THB')
  })
  it('pluralises and shows zero', () => {
    expect(openInvoicesText({ count: 0, amount: '0.00' })).toBe('0 invoices · 0.00 THB')
    expect(openInvoicesText({ count: 2, amount: '12000.50' })).toBe('2 invoices · 12,000.50 THB')
  })
})

describe('updatedAtText', () => {
  it('shows the Bangkok clock time', () => {
    expect(updatedAtText(new Date('2026-10-22T10:05:09Z'))).toBe('Updated 17:05:09')
  })
})
