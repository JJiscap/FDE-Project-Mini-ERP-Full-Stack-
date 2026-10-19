import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.fn()
const signOut = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: () => getSession(), signOut: () => signOut() } },
}))

import { DownloadPdfButton } from './DownloadPdfButton'

const fetchMock = vi.fn()
const createObjectURL = vi.fn(() => 'blob:fake-pdf')
const revokeObjectURL = vi.fn()
let clicked: { download: string; href: string }[] = []

function pdfResponse() {
  return new Response(new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' }), {
    status: 200,
    headers: { 'Content-Type': 'application/pdf' },
  })
}

function errorResponse(status: number, detail: string) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } })
  signOut.mockResolvedValue({ error: null })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
  clicked = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download, href: this.href })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  fetchMock.mockReset()
})

describe('DownloadPdfButton', () => {
  it('fetches the PDF with the user token and downloads it as INV-0001.pdf', async () => {
    fetchMock.mockResolvedValue(pdfResponse())
    render(<DownloadPdfButton invoiceId={7} number="INV-0001" />)

    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))

    await waitFor(() => expect(clicked).toHaveLength(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/invoices/7/pdf')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-123')
    expect(clicked[0].download).toBe('INV-0001.pdf')
    expect(clicked[0].href).toBe('blob:fake-pdf')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the API message when the download is refused', async () => {
    fetchMock.mockResolvedValue(errorResponse(404, 'Invoice not found.'))
    render(<DownloadPdfButton invoiceId={7} number="INV-0001" />)

    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invoice not found.')
    expect(clicked).toHaveLength(0)
  })

  it('shows a message when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<DownloadPdfButton invoiceId={7} number="INV-0001" />)

    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i)
  })

  it('is disabled while the PDF is being prepared, then ready again', async () => {
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)))
    render(<DownloadPdfButton invoiceId={7} number="INV-0001" />)

    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))

    expect(await screen.findByRole('button', { name: /preparing pdf/i })).toBeDisabled()
    resolve(pdfResponse())
    await waitFor(() => expect(screen.getByRole('button', { name: /download pdf/i })).toBeEnabled())
  })

  it('signs the user out when the session has ended (401)', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, 'Your login is not valid or has expired. Please sign in again.'))
    render(<DownloadPdfButton invoiceId={7} number="INV-0001" />)

    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }))

    await waitFor(() => expect(signOut).toHaveBeenCalled())
  })
})
