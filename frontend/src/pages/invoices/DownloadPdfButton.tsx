import { useState } from 'react'
import { Download, LoaderCircle } from 'lucide-react'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

/**
 * "Download PDF" for one Invoice (ticket 12). Put it on the Invoice detail page:
 *
 *   <DownloadPdfButton invoiceId={invoice.id} number={invoice.number} />
 *
 * `api.ts` only returns JSON, so this file makes its own authenticated request for the
 * PDF bytes (same token, same `/api` prefix, same ApiError messages) and then saves the
 * blob as `INV-0001.pdf`. A failure shows the API's message under the button.
 * Works on phones: it is a normal tap target, and the download goes through a temporary
 * link, which iOS Safari and Android Chrome both honour.
 */

const GENERIC_ERROR = 'Something went wrong. Please try again.'
const OFFLINE_ERROR = 'Cannot reach the server. Check your internet connection and try again.'

async function readDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string' && body.detail.trim()) return body.detail
  } catch {
    // not JSON: fall through to the generic message
  }
  return GENERIC_ERROR
}

/** Fetch `/api/invoices/{id}/pdf` with the user's token; returns the PDF as a Blob. */
async function fetchInvoicePdf(invoiceId: number): Promise<Blob> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    await supabase.auth.signOut()
    throw new ApiError(401, 'Your session has ended. Please log in again.')
  }

  let response: Response
  try {
    response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
      headers: { Accept: 'application/pdf', Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new ApiError(0, OFFLINE_ERROR)
  }

  if (!response.ok) {
    if (response.status === 401) await supabase.auth.signOut()
    throw new ApiError(response.status, await readDetail(response))
  }
  return response.blob()
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

interface DownloadPdfButtonProps {
  invoiceId: number
  /** The Invoice number, e.g. `INV-0001`; the file is saved as `INV-0001.pdf`. */
  number: string
  className?: string
}

export function DownloadPdfButton({ invoiceId, number, className }: DownloadPdfButtonProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      saveBlob(await fetchInvoicePdf(invoiceId), `${number}.pdf`)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        className={cn('w-full sm:w-auto', className)}
        disabled={busy}
        onClick={download}
      >
        {busy ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {busy ? 'Preparing PDF…' : 'Download PDF'}
      </Button>
      {error ? <ErrorAlert error={error} title="Could not download the PDF" /> : null}
    </div>
  )
}
