import { BANGKOK_TZ, formatTHB } from '@/lib/format'
import { canAccess, type Role } from '@/lib/permissions'

/** "Good morning" / "Good afternoon" / "Good evening" by the hour in Bangkok. */
export function greetingFor(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: BANGKOK_TZ, hour: '2-digit', hourCycle: 'h23' }).format(now),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Where the Open invoices tile leads: Accounting if the Role may see it, else Invoices, else nowhere. */
export function openInvoicesHref(role: Role | null | undefined): string | null {
  if (canAccess(role, 'accounting')) return '/accounting'
  if (canAccess(role, 'invoices')) return '/invoices'
  return null
}

/** `1 invoice · 9,630.00 THB` */
export function openInvoicesText(open: { count: number; amount: string }): string {
  const noun = open.count === 1 ? 'invoice' : 'invoices'
  return `${open.count} ${noun} · ${formatTHB(open.amount)}`
}

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: BANGKOK_TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** `Updated 17:05:09` (Bangkok time). */
export function updatedAtText(at: Date): string {
  return `Updated ${clock.format(at)}`
}
