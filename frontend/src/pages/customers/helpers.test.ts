import { describe, expect, it } from 'vitest'
import { emptyListMessage, pagerLabel, paymentTermsLabel } from './helpers'

// Expected values come from docs/scenario.md and the ticket: Café Lune pays in 30 days,
// Brew Lab Ari pays Cash, and 200 customers show "1–20 of 200".
describe('paymentTermsLabel', () => {
  it('shows 0 days as Cash', () => {
    expect(paymentTermsLabel(0)).toBe('Cash')
  })

  it('shows N days', () => {
    expect(paymentTermsLabel(30)).toBe('30 days')
  })

  it('uses the singular for one day', () => {
    expect(paymentTermsLabel(1)).toBe('1 day')
  })
})

describe('pagerLabel', () => {
  it('shows the first page of 200', () => {
    expect(pagerLabel(1, 20, 200)).toBe('1–20 of 200')
  })

  it('shows the last page of 200', () => {
    expect(pagerLabel(10, 20, 200)).toBe('181–200 of 200')
  })

  it('cuts the end at the total on a short last page', () => {
    expect(pagerLabel(3, 20, 45)).toBe('41–45 of 45')
  })

  it('says 0 of 0 when there is nothing', () => {
    expect(pagerLabel(1, 20, 0)).toBe('0 of 0')
  })
})

describe('emptyListMessage', () => {
  it('names the search that matched nothing', () => {
    expect(emptyListMessage('xyz', 'active').title).toBe("No customers match 'xyz'")
  })

  it('says no customers yet when nothing was searched or filtered', () => {
    expect(emptyListMessage('', 'all').title).toBe('No customers yet')
  })

  it('says no inactive customers when filtering inactive', () => {
    expect(emptyListMessage('', 'inactive').title).toBe('No inactive customers')
  })
})
