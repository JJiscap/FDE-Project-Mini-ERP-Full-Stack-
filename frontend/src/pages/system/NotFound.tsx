import { Link } from 'react-router'
import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'

/** Shown for a URL that does not exist. */
export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl pt-6">
      <EmptyState
        icon={SearchX}
        title="We could not find that page"
        description="The link may be old or mistyped. Go back to the Dashboard and choose from the menu."
        action={
          <Button asChild size="lg">
            <Link to="/">Back to Dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}
