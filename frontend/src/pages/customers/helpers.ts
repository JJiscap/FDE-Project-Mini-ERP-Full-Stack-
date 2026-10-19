import { useEffect, useState } from 'react'

/** A Customer as `/api/customers` returns it. */
export interface Customer {
  id: number
  name: string
  tax_id: string
  payment_terms_days: number
  address: string | null
  phone: string | null
  active: boolean
}

export interface CustomerPage {
  items: Customer[]
  total: number
  page: number
  page_size: number
}

export type ActiveFilter = 'active' | 'inactive' | 'all'

export const PAGE_SIZE = 20

/** 0 days is Cash. */
export function paymentTermsLabel(days: number): string {
  if (days === 0) return 'Cash'
  return days === 1 ? '1 day' : `${days} days`
}

/** "1–20 of 200" */
export function pagerLabel(page: number, pageSize: number, total: number): string {
  if (total === 0) return '0 of 0'
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return `${start}–${end} of ${total}`
}

export function emptyListMessage(q: string, filter: ActiveFilter): { title: string; description: string } {
  const search = q.trim()
  if (search) {
    return {
      title: `No customers match '${search}'`,
      description: 'Check the spelling, or search by part of the name or the Tax ID.',
    }
  }
  if (filter === 'inactive') {
    return { title: 'No inactive customers', description: 'Customers you deactivate will be listed here.' }
  }
  if (filter === 'active') {
    return { title: 'No active customers', description: 'Switch the filter to All to see deactivated customers.' }
  }
  return { title: 'No customers yet', description: 'Add your first customer to start selling.' }
}

/** The value, but only after it stopped changing for `delay` ms (search as you type). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
