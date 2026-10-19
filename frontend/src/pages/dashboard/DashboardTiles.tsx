import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Coffee, Landmark, ReceiptText, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatTHB } from '@/lib/format'
import type { Role } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { openInvoicesHref, openInvoicesParts } from './model'

/** `GET /api/dashboard` */
export interface DashboardData {
  sales_today: string
  low_stock_count: number
  open_invoices: { count: number; amount: string }
  stock_value: string
  as_of: string
}

interface TileProps {
  label: string
  icon: LucideIcon
  /** Undefined while loading. */
  value: ReactNode
  href: string | null
  tone?: 'default' | 'warning'
}

function Tile({ label, icon: Icon, value, href, tone = 'default' }: TileProps) {
  const body = (
    <Card
      className={cn(
        'h-full transition-colors',
        href && 'hover:bg-muted/50 focus-visible:ring-2',
        tone === 'warning' && 'border-warning/40 bg-warning-soft',
      )}
    >
      <CardContent className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 text-sm font-medium">{label}</span>
        </div>
        <div className="tabular min-w-0 break-words text-xl font-semibold leading-tight sm:text-2xl">{value}</div>
      </CardContent>
    </Card>
  )
  if (!href) return body
  return (
    <Link to={href} className="block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  )
}

/** Count on one line, amount on the next, so "9,630.00 THB" never breaks between the number and THB. */
function OpenInvoicesValue({ open }: { open: DashboardData['open_invoices'] }) {
  const { count, amount } = openInvoicesParts(open)
  return (
    <>
      <span className="block">{count}</span>
      <span className="block whitespace-nowrap text-base font-medium text-muted-foreground sm:text-lg">{amount}</span>
    </>
  )
}

function TileSkeleton() {
  return <Skeleton data-testid="tile-skeleton" className="h-7 w-3/4" />
}

interface DashboardTilesProps {
  /** Undefined while the first answer is on its way. */
  data: DashboardData | undefined
  role: Role
}

/** The four Dashboard numbers: 2 x 2 on a phone, four across on a desktop. */
export function DashboardTiles({ data, role }: DashboardTilesProps) {
  const lowStock = data?.low_stock_count ?? 0
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Sales today (incl. VAT)"
        icon={ReceiptText}
        value={data ? formatTHB(data.sales_today) : <TileSkeleton />}
        href={null}
      />
      <Tile
        label="Low stock"
        icon={TriangleAlert}
        tone={data && lowStock > 0 ? 'warning' : 'default'}
        value={data ? data.low_stock_count : <TileSkeleton />}
        href="/products?low_stock=true"
      />
      <Tile
        label="Open invoices"
        icon={Landmark}
        value={data ? <OpenInvoicesValue open={data.open_invoices} /> : <TileSkeleton />}
        href={openInvoicesHref(role)}
      />
      <Tile
        label="Stock value"
        icon={Coffee}
        value={data ? formatTHB(data.stock_value) : <TileSkeleton />}
        href={null}
      />
    </div>
  )
}
