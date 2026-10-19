import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface Column<T> {
  /** Column heading. On phones it becomes the label of the value. */
  header: string
  /** Cell content. Use `<Money value=... />` for money and `formatQty` for quantities. */
  cell: (row: T) => ReactNode
  /** `right` for money and quantities. */
  align?: 'left' | 'right'
  /**
   * The row's main text (name, document number). On phones it is the card title,
   * and with `getRowHref` it is the link. Exactly one column should set it; the first column is the default.
   */
  isTitle?: boolean
  /** Skip this column on phones (use sparingly). */
  hideOnMobile?: boolean
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  getRowKey: (row: T) => string | number
  /** Makes each row open a detail page. */
  getRowHref?: (row: T) => string
  isLoading?: boolean
  /** Shown when there are no rows (pass an `<EmptyState />`). */
  empty: ReactNode
  /** Screen-reader description of the table. */
  caption: string
}

/**
 * Responsive list pattern. From 768px it is a normal table (it scrolls inside its
 * own box if ever too wide). On phones each row becomes a card, so the page never scrolls sideways.
 */
export function DataTable<T>({ columns, rows, getRowKey, getRowHref, isLoading, empty, caption }: DataTableProps<T>) {
  const navigate = useNavigate()
  const titleIndex = Math.max(0, columns.findIndex((c) => c.isTitle))

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading" className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (!rows || rows.length === 0) return <>{empty}</>

  return (
    <>
      {/* Tablet and desktop */}
      <div className="hidden rounded-lg border bg-card md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead key={c.header} className={cn('h-11', c.align === 'right' && 'text-right', c.className)}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const href = getRowHref?.(row)
              return (
                <TableRow
                  key={getRowKey(row)}
                  className={cn(href && 'cursor-pointer')}
                  onClick={href ? () => navigate(href) : undefined}
                >
                  {columns.map((c, i) => (
                    <TableCell key={c.header} className={cn('py-3', c.align === 'right' && 'text-right', c.className)}>
                      {href && i === titleIndex ? (
                        <Link to={href} className="font-medium text-primary underline-offset-4 hover:underline">
                          {c.cell(row)}
                        </Link>
                      ) : (
                        c.cell(row)
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Phones */}
      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map((row) => {
          const href = getRowHref?.(row)
          const title = columns[titleIndex]
          const body = (
            <>
              <div className="font-semibold">{title.cell(row)}</div>
              <dl className="mt-2 space-y-1.5">
                {columns.map((c, i) =>
                  i === titleIndex || c.hideOnMobile ? null : (
                    <div key={c.header} className="flex items-baseline justify-between gap-4">
                      <dt className="shrink-0 text-sm text-muted-foreground">{c.header}</dt>
                      <dd className={cn('min-w-0 text-right', c.className)}>{c.cell(row)}</dd>
                    </div>
                  ),
                )}
              </dl>
            </>
          )
          return (
            <li key={getRowKey(row)}>
              {href ? (
                <Link to={href} className="block rounded-lg border bg-card p-4 active:bg-muted">
                  {body}
                </Link>
              ) : (
                <div className="rounded-lg border bg-card p-4">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
