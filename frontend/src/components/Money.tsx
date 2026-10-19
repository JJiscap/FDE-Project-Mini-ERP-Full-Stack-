import { formatTHB } from '@/lib/format'
import { cn } from '@/lib/utils'

interface MoneyProps {
  /** API money arrives as a string like "9630.00". */
  value: number | string | null | undefined
  className?: string
  /** Bold, for totals. */
  strong?: boolean
}

/** Money as `9,630.00 THB`: right-aligned, tabular digits, never wraps. */
export function Money({ value, className, strong }: MoneyProps) {
  return (
    <span className={cn('tabular block text-right whitespace-nowrap', strong && 'font-semibold', className)}>
      {formatTHB(value)}
    </span>
  )
}
