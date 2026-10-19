import { describe, expect, it } from 'vitest'
import { movementLabel, parseQuantity, productLabel, signedQty, successMessage } from './helpers'

// Expected values come from docs/scenario.md and the ticket (170 kg + 30 = 200 kg, IN-0001).
const arabica = { id: 1, sku: 'ARB-1KG', name: 'Arabica, 1 kg bag', unit: 'kg', on_hand: 170, reorder_level: 50, low_stock: false }

describe('parseQuantity', () => {
  it('accepts a whole number for any type', () => {
    expect(parseQuantity('30', 'in')).toEqual({ ok: true, value: 30 })
    expect(parseQuantity(' 5 ', 'out')).toEqual({ ok: true, value: 5 })
  })

  it('accepts a signed whole number for an Adjustment only', () => {
    expect(parseQuantity('-3', 'adjust')).toEqual({ ok: true, value: -3 })
    expect(parseQuantity('+4', 'adjust')).toEqual({ ok: true, value: 4 })
    expect(parseQuantity('-3', 'in')).toEqual({ ok: false, message: 'Quantity must be greater than 0' })
    expect(parseQuantity('-3', 'out')).toEqual({ ok: false, message: 'Quantity must be greater than 0' })
  })

  it('refuses zero, empty and non-whole quantities with a message that says what to fix', () => {
    expect(parseQuantity('0', 'in')).toEqual({ ok: false, message: "Quantity can't be 0" })
    expect(parseQuantity('0', 'adjust')).toEqual({ ok: false, message: "Quantity can't be 0" })
    expect(parseQuantity('', 'in')).toEqual({ ok: false, message: 'Enter a quantity' })
    expect(parseQuantity('2.5', 'in')).toEqual({ ok: false, message: 'Quantity must be a whole number' })
    expect(parseQuantity('abc', 'out')).toEqual({ ok: false, message: 'Quantity must be a whole number' })
  })
})

describe('labels', () => {
  it('shows the Product with its On Hand in the picker', () => {
    expect(productLabel(arabica)).toBe('ARB-1KG · Arabica, 1 kg bag · 170 kg')
  })

  it('names movement types with glossary words', () => {
    expect(movementLabel('in')).toBe('Stock-in')
    expect(movementLabel('out')).toBe('Stock-out')
    expect(movementLabel('adjust')).toBe('Adjustment')
    expect(movementLabel('opening')).toBe('Opening Stock')
    expect(movementLabel('sale')).toBe('Sale')
  })

  it('writes the stored quantity with its sign and unit', () => {
    expect(signedQty(30, 'kg')).toBe('+30 kg')
    expect(signedQty(-3, 'kg')).toBe('-3 kg')
  })

  it('confirms a recorded movement with its Document Number and the new On Hand', () => {
    expect(successMessage('IN-0001', arabica, 200)).toBe('IN-0001 recorded: ARB-1KG now 200 kg')
  })
})
