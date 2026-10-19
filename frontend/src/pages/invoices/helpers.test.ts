import { describe, expect, it } from 'vitest'
import { emptyListMessage, overdueLabel, pagerLabel } from './helpers'

describe('overdueLabel', () => {
  it('counts the days past the Due Date', () => {
    expect(overdueLabel(1)).toBe('Overdue by 1 day')
    expect(overdueLabel(15)).toBe('Overdue by 15 days')
  })
})

describe('pagerLabel', () => {
  it('shows the rows on this page out of all rows', () => {
    expect(pagerLabel(1, 20, 45)).toBe('1–20 of 45')
    expect(pagerLabel(3, 20, 45)).toBe('41–45 of 45')
    expect(pagerLabel(1, 20, 0)).toBe('0 of 0')
  })
})

describe('emptyListMessage', () => {
  it('says the search found nothing, quoting it', () => {
    expect(emptyListMessage('zzz', 'all').title).toBe("No invoices match 'zzz'")
  })

  it('explains an empty list without a search, per filter', () => {
    expect(emptyListMessage('', 'all').title).toBe('No invoices yet')
    expect(emptyListMessage('', 'all').description).toMatch(/confirm/i)
    expect(emptyListMessage('', 'open').title).toBe('No open invoices')
    expect(emptyListMessage('', 'overdue').title).toBe('No overdue invoices')
    expect(emptyListMessage('', 'paid').title).toBe('No paid invoices')
  })
})
