import { describe, expect, it } from 'vitest'
import {
  addDraftLine,
  computeTotals,
  emptyListMessage,
  lineAmount,
  pagerLabel,
  parseQuantity,
  productLabel,
  removeDraftLine,
  setDraftQuantity,
  stockWarning,
  type DraftLine,
  type ProductChoice,
} from './helpers'

const arb: ProductChoice = {
  id: 1,
  sku: 'ARB-1KG',
  name: 'Arabica, 1 kg bag',
  unit: 'kg',
  price: '450.00',
  on_hand: 170,
  active: true,
}
const rob: ProductChoice = { ...arb, id: 2, sku: 'ROB-1KG', name: 'Robusta, 1 kg bag', price: '320.00', on_hand: 35 }

describe('money in the browser (the same rules as the server)', () => {
  it('20 x ARB-1KG at 450.00 is 9,000.00, VAT 630.00, Total 9,630.00', () => {
    const lines = [{ quantity: 20, unit_price: '450.00' }]
    expect(lineAmount(20, '450.00')).toBe('9000.00')
    expect(computeTotals(lines)).toEqual({ subtotal: '9000.00', vat: '630.00', total: '9630.00' })
  })

  it('rounds VAT half up: 1.50 x 7% = 0.105 -> 0.11', () => {
    expect(computeTotals([{ quantity: 1, unit_price: '1.50' }])).toEqual({
      subtotal: '1.50',
      vat: '0.11',
      total: '1.61',
    })
  })

  it('VAT is taken on the whole subtotal, not line by line', () => {
    // Per line: 0.21 -> 0.01 twice = 0.02. On the subtotal 0.42 x 7% = 0.0294 -> 0.03.
    const lines = [
      { quantity: 1, unit_price: '0.21' },
      { quantity: 1, unit_price: '0.21' },
    ]
    expect(computeTotals(lines).vat).toBe('0.03')
  })

  it('an order without lines totals 0.00', () => {
    expect(computeTotals([])).toEqual({ subtotal: '0.00', vat: '0.00', total: '0.00' })
  })

  it('reads prices that come without two decimals', () => {
    expect(lineAmount(3, '450')).toBe('1350.00')
    expect(lineAmount(2, '12.5')).toBe('25.00')
  })
})

describe('quantity', () => {
  it('accepts a whole number above 0', () => {
    expect(parseQuantity('20')).toEqual({ ok: true, value: 20 })
    expect(parseQuantity(' 7 ')).toEqual({ ok: true, value: 7 })
  })

  it('refuses 0, negatives, decimals, letters and empty with a message that says what to fix', () => {
    expect(parseQuantity('0')).toEqual({ ok: false, message: 'Quantity must be greater than 0' })
    expect(parseQuantity('-3')).toEqual({ ok: false, message: 'Quantity must be greater than 0' })
    expect(parseQuantity('1.5')).toEqual({ ok: false, message: 'Quantity must be a whole number' })
    expect(parseQuantity('abc')).toEqual({ ok: false, message: 'Quantity must be a whole number' })
    expect(parseQuantity('')).toEqual({ ok: false, message: 'Enter a quantity' })
  })

  it('refuses more than a million', () => {
    expect(parseQuantity('1000001')).toEqual({ ok: false, message: 'Quantity must be 1,000,000 or less' })
  })
})

describe('stock warning (a hint only: the server enforces stock at Confirm)', () => {
  it('warns when the quantity is more than On Hand', () => {
    expect(stockWarning(171, 170, 'kg')).toBe('Only 170 kg on hand')
    expect(stockWarning(500, 0, 'box')).toBe('Only 0 box on hand')
  })

  it('is silent when On Hand covers the quantity', () => {
    expect(stockWarning(170, 170, 'kg')).toBeNull()
    expect(stockWarning(20, 170, 'kg')).toBeNull()
  })
})

describe('draft lines before the order is saved', () => {
  it('adds a line with the Product price shown now', () => {
    const lines = addDraftLine([], arb, 20)
    expect(lines).toEqual([
      { product_id: 1, sku: 'ARB-1KG', name: 'Arabica, 1 kg bag', unit: 'kg', unit_price: '450.00', on_hand: 170, quantity: 20 },
    ])
  })

  it('adding the same Product again adds to its line (no duplicate)', () => {
    const lines = addDraftLine(addDraftLine([], arb, 5), arb, 7)
    expect(lines).toHaveLength(1)
    expect(lines[0].quantity).toBe(12)
  })

  it('keeps the order lines were added in', () => {
    const lines = addDraftLine(addDraftLine([], rob, 1), arb, 1)
    expect(lines.map((l) => l.sku)).toEqual(['ROB-1KG', 'ARB-1KG'])
  })

  it('changes and removes a line without touching the others', () => {
    const start: DraftLine[] = addDraftLine(addDraftLine([], arb, 1), rob, 2)
    expect(setDraftQuantity(start, 1, 9).map((l) => l.quantity)).toEqual([9, 2])
    expect(removeDraftLine(start, 1).map((l) => l.sku)).toEqual(['ROB-1KG'])
  })
})

describe('labels', () => {
  it('the Product picker row reads "SKU · name · price · On Hand"', () => {
    expect(productLabel(arb)).toBe('ARB-1KG · Arabica, 1 kg bag · 450.00 THB · 170 kg on hand')
  })

  it('pager label', () => {
    expect(pagerLabel(1, 20, 45)).toBe('1–20 of 45')
    expect(pagerLabel(3, 20, 45)).toBe('41–45 of 45')
    expect(pagerLabel(1, 20, 0)).toBe('0 of 0')
  })

  it('empty list says "No sales orders yet" when nothing was searched or filtered', () => {
    expect(emptyListMessage('', 'all').title).toBe('No sales orders yet')
    expect(emptyListMessage('lune', 'all').title).toBe("No sales orders match 'lune'")
    expect(emptyListMessage('', 'draft').title).toBe('No draft sales orders')
    expect(emptyListMessage('', 'cancelled').title).toBe('No cancelled sales orders')
  })
})
