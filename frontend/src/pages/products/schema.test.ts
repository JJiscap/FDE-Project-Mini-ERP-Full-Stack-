import { describe, expect, it } from 'vitest'
import { filtersToParams, paramsToFilters, productSchema, splitApiErrors, toPayload } from './schema'

const valid = { sku: 'NEW-1KG', name: 'New bean', unit: 'kg', price: '500', cost: '350.50', reorder_level: '20' }

function firstMessage(input: Record<string, unknown>, field: string): string | undefined {
  const result = productSchema.safeParse(input)
  if (result.success) return undefined
  return result.error.issues.find((i) => i.path[0] === field)?.message
}

describe('productSchema', () => {
  it('accepts a complete product', () => {
    expect(productSchema.safeParse(valid).success).toBe(true)
  })

  it('refuses a negative price and cost with the API wording', () => {
    expect(firstMessage({ ...valid, price: '-1' }, 'price')).toBe('Price must be 0 or more')
    expect(firstMessage({ ...valid, cost: '-1' }, 'cost')).toBe('Cost must be 0 or more')
  })

  it('accepts a price of 0', () => {
    expect(productSchema.safeParse({ ...valid, price: '0' }).success).toBe(true)
  })

  it('refuses text and more than two decimals in money', () => {
    expect(firstMessage({ ...valid, price: 'abc' }, 'price')).toBe('Price must be a number')
    expect(firstMessage({ ...valid, price: '1.234' }, 'price')).toBe('Price can have at most 2 decimal places')
  })

  it('asks for the fields that are empty', () => {
    expect(firstMessage({ ...valid, sku: '  ' }, 'sku')).toBe('SKU is required')
    expect(firstMessage({ ...valid, name: '' }, 'name')).toBe('Name is required')
    expect(firstMessage({ ...valid, price: '' }, 'price')).toBe('Price is required')
  })

  it('refuses a negative or fractional reorder level', () => {
    expect(firstMessage({ ...valid, reorder_level: '-1' }, 'reorder_level')).toBe('Reorder level must be 0 or more')
    expect(firstMessage({ ...valid, reorder_level: '2.5' }, 'reorder_level')).toBe('Reorder level must be a whole number')
  })

  it('only allows kg or box', () => {
    expect(productSchema.safeParse({ ...valid, unit: 'lb' }).success).toBe(false)
  })
})

describe('toPayload', () => {
  it('sends the reorder level as a whole number and keeps money as text', () => {
    expect(toPayload(productSchema.parse(valid))).toEqual({
      sku: 'NEW-1KG',
      name: 'New bean',
      unit: 'kg',
      price: '500',
      cost: '350.50',
      reorder_level: 20,
    })
  })
})

describe('splitApiErrors', () => {
  it('puts each message next to its field', () => {
    expect(splitApiErrors('Price must be 0 or more; Cost is required')).toEqual({
      fields: { price: 'Price must be 0 or more', cost: 'Cost is required' },
      rest: [],
    })
  })

  it('maps the duplicate SKU conflict to the SKU field', () => {
    expect(splitApiErrors('SKU ARB-1KG already exists').fields).toEqual({ sku: 'SKU ARB-1KG already exists' })
  })

  it('keeps messages it cannot place', () => {
    expect(splitApiErrors('Something odd; Name is required')).toEqual({
      fields: { name: 'Name is required' },
      rest: ['Something odd'],
    })
  })
})

describe('list filters in the address bar', () => {
  it('defaults to active products, page 1', () => {
    expect(paramsToFilters(new URLSearchParams(''))).toEqual({ q: '', status: 'active', lowStock: false, page: 1 })
  })

  it('reads the Dashboard link ?low_stock=true', () => {
    expect(paramsToFilters(new URLSearchParams('low_stock=true')).lowStock).toBe(true)
  })

  it('writes only what differs from the defaults', () => {
    expect(filtersToParams({ q: '', status: 'active', lowStock: false, page: 1 }).toString()).toBe('')
    expect(filtersToParams({ q: 'arb', status: 'all', lowStock: true, page: 2 }).toString()).toBe(
      'q=arb&active=all&low_stock=true&page=2',
    )
  })

  it('ignores a bad page number', () => {
    expect(paramsToFilters(new URLSearchParams('page=abc')).page).toBe(1)
    expect(paramsToFilters(new URLSearchParams('page=-3')).page).toBe(1)
  })
})
