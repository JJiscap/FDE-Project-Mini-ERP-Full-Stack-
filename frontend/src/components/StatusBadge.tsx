import type { ComponentType } from 'react'
import {
  Ban,
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Clock,
  TrendingDown,
  type LucideProps,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type Status =
  | 'draft'
  | 'confirmed'
  | 'cancelled'
  | 'open'
  | 'paid'
  | 'overdue'
  | 'low-stock'
  | 'active'
  | 'inactive'

interface StatusStyle {
  label: string
  icon: ComponentType<LucideProps>
  className: string
}

/**
 * Colour is never the only signal: every status has its own icon and label.
 * Each pair (soft background, strong text) meets WCAG AA contrast.
 */
const STATUS: Record<Status, StatusStyle> = {
  draft: { label: 'Draft', icon: CircleDashed, className: 'bg-secondary text-secondary-foreground border-border' },
  confirmed: { label: 'Confirmed', icon: CircleCheck, className: 'bg-info-soft text-info border-info/25' },
  cancelled: {
    label: 'Cancelled',
    icon: Ban,
    className: 'bg-muted text-muted-foreground border-border line-through decoration-1',
  },
  open: { label: 'Open', icon: Clock, className: 'bg-warning-soft text-warning border-warning/25' },
  paid: { label: 'Paid', icon: BadgeCheck, className: 'bg-success-soft text-success border-success/25' },
  overdue: { label: 'Overdue', icon: CircleAlert, className: 'bg-danger-soft text-danger border-danger/25' },
  'low-stock': { label: 'Low stock', icon: TrendingDown, className: 'bg-warning-soft text-warning border-warning/25' },
  active: { label: 'Active', icon: CircleCheck, className: 'bg-success-soft text-success border-success/25' },
  inactive: { label: 'Deactivated', icon: CircleSlash, className: 'bg-muted text-muted-foreground border-border' },
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

/** One badge for every status in the app (orders, invoices, stock, master data). */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, icon: Icon, className: tone } = STATUS[status]
  return (
    <Badge variant="outline" className={cn('gap-1', tone, className)}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  )
}
