import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { DashboardTiles, type DashboardData } from './DashboardTiles'

const data: DashboardData = {
  sales_today: '9630.00',
  low_stock_count: 1,
  open_invoices: { count: 1, amount: '9630.00' },
  stock_value: '100700.00',
  as_of: '2026-10-22',
}

function renderTiles(props: Partial<Parameters<typeof DashboardTiles>[0]> = {}) {
  return render(
    <MemoryRouter>
      <DashboardTiles data={data} role="accountant" {...props} />
    </MemoryRouter>,
  )
}

describe('DashboardTiles', () => {
  it('shows the four tiles with the US-1 numbers', () => {
    renderTiles()

    expect(screen.getByText('Sales today (incl. VAT)')).toBeInTheDocument()
    expect(screen.getByText('9,630.00 THB')).toBeInTheDocument()
    expect(screen.getByText('Low stock')).toBeInTheDocument()
    expect(screen.getByText('Open invoices')).toBeInTheDocument()
    expect(screen.getByText('1 invoice · 9,630.00 THB')).toBeInTheDocument()
    expect(screen.getByText('Stock value')).toBeInTheDocument()
    expect(screen.getByText('100,700.00 THB')).toBeInTheDocument()
  })

  it('links Low stock to the filtered Products list', () => {
    renderTiles()

    expect(screen.getByRole('link', { name: /low stock/i })).toHaveAttribute('href', '/products?low_stock=true')
  })

  it('links Open invoices to Accounting for an Accountant, to Invoices for Sales, nowhere for Warehouse', () => {
    const { unmount } = renderTiles({ role: 'accountant' })
    expect(screen.getByRole('link', { name: /open invoices/i })).toHaveAttribute('href', '/accounting')
    unmount()

    const second = renderTiles({ role: 'sales' })
    expect(screen.getByRole('link', { name: /open invoices/i })).toHaveAttribute('href', '/invoices')
    second.unmount()

    renderTiles({ role: 'warehouse' })
    expect(screen.queryByRole('link', { name: /open invoices/i })).not.toBeInTheDocument()
  })

  it('shows skeletons, not numbers, while loading', () => {
    renderTiles({ data: undefined })

    expect(screen.getAllByTestId('tile-skeleton')).toHaveLength(4)
    expect(screen.queryByText('9,630.00 THB')).not.toBeInTheDocument()
  })
})
