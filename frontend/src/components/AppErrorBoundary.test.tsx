import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccessBoundary } from '@/components/AccessBoundary'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { installChunkReload, isChunkLoadError } from '@/lib/chunk-errors'

function Boom({ message }: { message: string }): never {
  throw new Error(message)
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('AppErrorBoundary', () => {
  it('renders its children when nothing fails', () => {
    render(
      <AppErrorBoundary>
        <p>All good</p>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('shows a friendly message and a Reload button instead of a blank page', () => {
    render(
      <AppErrorBoundary>
        <Boom message="x is not a function" />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('This page could not be shown')
    expect(screen.getByText('Siam Bean ERP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.queryByText('x is not a function')).not.toBeInTheDocument()
  })

  it('explains a failed lazy chunk as a new version and offers a reload', () => {
    render(
      <AppErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: https://x/assets/index-abc.js" />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('A new version of Siam Bean ERP is ready')
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
  })

  it('Reload page reloads the window', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    render(
      <AppErrorBoundary>
        <Boom message="boom" />
      </AppErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('a failed lazy page inside the layout', () => {
  it('offers a reload (a plain "Try again" would re-use the failed import)', () => {
    render(
      <AccessBoundary resetKey="/products">
        <Boom message="Failed to fetch dynamically imported module: /assets/products.js" />
      </AccessBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('A new version of Siam Bean ERP is ready')
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: /assets/x.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Loading chunk 12 failed.',
  ])('recognises "%s"', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isChunkLoadError(new Error('x is undefined'))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })
})

describe('installChunkReload', () => {
  it('reloads once, then lets the error through if it happens again right away', () => {
    const listeners: Record<string, (e: Event) => void> = {}
    const store = new Map<string, string>()
    const reload = vi.fn()
    const target = {
      addEventListener: (name: string, fn: (e: Event) => void) => {
        listeners[name] = fn
      },
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      location: { reload },
    } as unknown as Window
    let clock = 1_000_000
    installChunkReload(target, () => clock)

    const first = { preventDefault: vi.fn() } as unknown as Event
    listeners['vite:preloadError'](first)
    expect(first.preventDefault).toHaveBeenCalled()
    expect(reload).toHaveBeenCalledTimes(1)

    clock += 2_000
    const second = { preventDefault: vi.fn() } as unknown as Event
    listeners['vite:preloadError'](second)
    expect(second.preventDefault).not.toHaveBeenCalled()
    expect(reload).toHaveBeenCalledTimes(1)

    clock += 60_000
    listeners['vite:preloadError']({ preventDefault: vi.fn() } as unknown as Event)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
