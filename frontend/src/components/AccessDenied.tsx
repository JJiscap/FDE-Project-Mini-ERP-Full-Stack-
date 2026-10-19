import { Link } from 'react-router'
import { LockKeyhole } from 'lucide-react'
import { useMe } from '@/auth/useMe'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { ROLE_LABELS, SCREEN_LABELS, rolesWithAccess, type Screen } from '@/lib/permissions'

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * The page shown when a Role may not open a screen, or when the API answers 403.
 * Pass `screen` to say who does have access.
 */
export function AccessDenied({ screen }: { screen?: Screen }) {
  const { data: me } = useMe()
  const yourRole = me ? ROLE_LABELS[me.role] : null

  const who = screen
    ? `${SCREEN_LABELS[screen]} is only open to ${joinList(rolesWithAccess(screen).map((r) => ROLE_LABELS[r]))}.`
    : 'Your role cannot do this.'
  const you = yourRole ? ` You are logged in as ${yourRole}.` : ''

  return (
    <div className="mx-auto max-w-xl pt-6">
      <EmptyState
        icon={LockKeyhole}
        title="You do not have access to this page"
        description={`${who}${you} If you need it, ask the owner to change your role.`}
        action={
          <Button asChild size="lg">
            <Link to="/">Back to Dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}
