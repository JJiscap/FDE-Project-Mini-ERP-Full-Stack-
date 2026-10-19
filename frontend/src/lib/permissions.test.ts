import { describe, expect, it } from 'vitest'
import {
  canAccess,
  canConfirmOrders,
  canEditCustomers,
  canEditProducts,
  canMoveStock,
  canRecordPayments,
  rolesWithAccess,
  screensForRole,
} from './permissions'

// Mirrors the role matrix in .scratch/mini-erp/spec.md.
describe('screen access', () => {
  it('lets every role see the dashboard and products', () => {
    for (const role of ['admin', 'sales', 'warehouse', 'accountant'] as const) {
      expect(canAccess(role, 'dashboard')).toBe(true)
      expect(canAccess(role, 'products')).toBe(true)
    }
  })

  it('lets admin open everything', () => {
    expect(screensForRole('admin')).toHaveLength(7)
  })

  it('refuses Sales the Accounting screen (US-3)', () => {
    expect(canAccess('sales', 'accounting')).toBe(false)
  })

  it('gives Sales customers, sales orders and invoices but not stock', () => {
    expect(screensForRole('sales')).toEqual(
      ['dashboard', 'products', 'customers', 'sales-orders', 'invoices'],
    )
  })

  it('gives Warehouse only the dashboard, products and stock', () => {
    expect(screensForRole('warehouse')).toEqual(['dashboard', 'products', 'stock'])
  })

  it('gives the Accountant customers, invoices and accounting', () => {
    expect(screensForRole('accountant')).toEqual(
      ['dashboard', 'products', 'customers', 'invoices', 'accounting'],
    )
  })

  it('lists the roles that may open a screen', () => {
    expect(rolesWithAccess('accounting')).toEqual(['admin', 'accountant'])
    expect(rolesWithAccess('stock')).toEqual(['admin', 'warehouse'])
  })
})

describe('action helpers', () => {
  it('only Admin edits products and prices', () => {
    expect(canEditProducts('admin')).toBe(true)
    expect(canEditProducts('sales')).toBe(false)
    expect(canEditProducts('warehouse')).toBe(false)
    expect(canEditProducts('accountant')).toBe(false)
  })

  it('Admin and Sales edit customers', () => {
    expect(canEditCustomers('admin')).toBe(true)
    expect(canEditCustomers('sales')).toBe(true)
    expect(canEditCustomers('accountant')).toBe(false)
    expect(canEditCustomers('warehouse')).toBe(false)
  })

  it('only Admin and Sales confirm orders (Warehouse cannot, US-3)', () => {
    expect(canConfirmOrders('sales')).toBe(true)
    expect(canConfirmOrders('admin')).toBe(true)
    expect(canConfirmOrders('warehouse')).toBe(false)
    expect(canConfirmOrders('accountant')).toBe(false)
  })

  it('only Admin and Warehouse move stock', () => {
    expect(canMoveStock('warehouse')).toBe(true)
    expect(canMoveStock('admin')).toBe(true)
    expect(canMoveStock('sales')).toBe(false)
  })

  it('only Admin and the Accountant record payments', () => {
    expect(canRecordPayments('accountant')).toBe(true)
    expect(canRecordPayments('admin')).toBe(true)
    expect(canRecordPayments('sales')).toBe(false)
  })

  it('treats a missing role as no access', () => {
    expect(canAccess(undefined, 'dashboard')).toBe(false)
    expect(canEditProducts(undefined)).toBe(false)
  })
})
