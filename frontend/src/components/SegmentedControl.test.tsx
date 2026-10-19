import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SegmentedControl } from '@/components/SegmentedControl'

const OPTIONS = [
  { value: 'transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
]

function Harness() {
  const [value, setValue] = useState('transfer')
  return <SegmentedControl ariaLabel="Method" options={OPTIONS} value={value} onChange={setValue} />
}

describe('SegmentedControl', () => {
  it('is a radio group with the selected option checked and the only tab stop', () => {
    render(<Harness />)
    expect(screen.getByRole('radiogroup', { name: 'Method' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Bank transfer' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Bank transfer' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Cash' })).toHaveAttribute('tabindex', '-1')
  })

  it('clicking selects an option', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('radio', { name: 'Cash' }))
    expect(screen.getByRole('radio', { name: 'Cash' })).toBeChecked()
  })

  it('arrow keys move the selection and the focus, and wrap around', () => {
    render(<Harness />)
    const first = screen.getByRole('radio', { name: 'Bank transfer' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Cash' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Cash' })).toHaveFocus()

    fireEvent.keyDown(screen.getByRole('radio', { name: 'Cash' }), { key: 'ArrowLeft' })
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Bank transfer' }), { key: 'ArrowLeft' })
    expect(screen.getByRole('radio', { name: 'Cheque' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Cheque' })).toHaveFocus()
  })
})
