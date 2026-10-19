import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorAlert } from '@/components/ErrorAlert'

afterEach(() => vi.restoreAllMocks())

describe('ConfirmDialog', () => {
  it('names the action, offers a way back and takes the keyboard focus', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Deactivate Café Lune?"
        description="It will no longer be offered."
        confirmLabel="Deactivate customer"
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('alertdialog', { name: 'Deactivate Café Lune?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deactivate customer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument()
  })

  it('can show a block-level error inside the description without invalid HTML nesting', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Confirm SO-0001?"
        description={<ErrorAlert error="Not enough stock for ARB-1KG" />}
        confirmLabel="Confirm order"
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Not enough stock for ARB-1KG')
    const nesting = error.mock.calls.filter((call) => String(call[0]).includes('cannot be a descendant'))
    expect(nesting).toEqual([])
  })
})
