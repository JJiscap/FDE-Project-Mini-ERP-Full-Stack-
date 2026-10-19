/**
 * The role matrix from .scratch/mini-erp/spec.md, in one place.
 * The menu and the route guards read this file. The server enforces the same
 * rules with 403, so this only decides what to show.
 */

export type Role = 'admin' | 'sales' | 'warehouse' | 'accountant'

export type Screen =
  | 'dashboard'
  | 'products'
  | 'customers'
  | 'sales-orders'
  | 'stock'
  | 'invoices'
  | 'accounting'

export const ROLES: readonly Role[] = ['admin', 'sales', 'warehouse', 'accountant']

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  sales: 'Sales',
  warehouse: 'Warehouse',
  accountant: 'Accountant',
}

/** Menu order. */
export const SCREENS: readonly Screen[] = [
  'dashboard',
  'products',
  'customers',
  'sales-orders',
  'stock',
  'invoices',
  'accounting',
]

/** Which roles may open each screen. */
const SCREEN_ROLES: Record<Screen, readonly Role[]> = {
  dashboard: ['admin', 'sales', 'warehouse', 'accountant'],
  products: ['admin', 'sales', 'warehouse', 'accountant'],
  customers: ['admin', 'sales', 'accountant'],
  'sales-orders': ['admin', 'sales'],
  stock: ['admin', 'warehouse'],
  invoices: ['admin', 'sales', 'accountant'],
  accounting: ['admin', 'accountant'],
}

type MaybeRole = Role | null | undefined

export function canAccess(role: MaybeRole, screen: Screen): boolean {
  return !!role && SCREEN_ROLES[screen].includes(role)
}

export function screensForRole(role: MaybeRole): Screen[] {
  return SCREENS.filter((s) => canAccess(role, s))
}

export function rolesWithAccess(screen: Screen): Role[] {
  return ROLES.filter((r) => SCREEN_ROLES[screen].includes(r))
}

const has = (allowed: readonly Role[]) => (role: MaybeRole) => !!role && allowed.includes(role)

/** Create, edit, re-price, deactivate products. */
export const canEditProducts = has(['admin'])
/** Create, edit, deactivate customers. */
export const canEditCustomers = has(['admin', 'sales'])
/** Create, edit a Draft, cancel a Draft Sales Order. */
export const canEditSalesOrders = has(['admin', 'sales'])
/** Confirm a Draft Sales Order (issues the Invoice). */
export const canConfirmOrders = has(['admin', 'sales'])
/** Stock-in, Stock-out, Adjustment and movement history. */
export const canMoveStock = has(['admin', 'warehouse'])
/** Open the Accounting screen and record Payments. */
export const canRecordPayments = has(['admin', 'accountant'])
