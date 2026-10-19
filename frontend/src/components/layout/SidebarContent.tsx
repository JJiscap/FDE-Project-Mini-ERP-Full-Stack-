import { NavLink } from 'react-router'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { useCurrentUser } from '@/auth/useMe'
import { Brand } from '@/components/Brand'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROLE_LABELS, SCREEN_LABELS, canAccess } from '@/lib/permissions'
import { MODULE_ROUTES } from '@/routes'
import { cn } from '@/lib/utils'

/**
 * Brand, company, role-filtered menu, user and logout.
 * Used in the desktop sidebar and inside the phone drawer.
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const me = useCurrentUser()
  const { signOut } = useAuth()
  const items = MODULE_ROUTES.filter((r) => canAccess(me.role, r.screen))

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-6 pb-5">
        <Brand markClassName="text-sidebar-primary" />
        <p className="mt-2 text-sm text-sidebar-foreground/75">{me.company.name}</p>
      </div>

      <nav aria-label="Main menu" className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {items.map(({ screen, path, icon: Icon }) => (
            <li key={screen}>
              <NavLink
                to={path}
                end={path === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-base font-medium transition-colors',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    'focus-visible:outline-sidebar-ring',
                    isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                  )
                }
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {SCREEN_LABELS[screen]}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="truncate font-medium">{me.full_name}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge className="border-transparent bg-sidebar-primary text-sidebar-primary-foreground">
            {ROLE_LABELS[me.role]}
          </Badge>
          <span className="min-w-0 truncate text-sm text-sidebar-foreground/75">{me.email}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-3 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => void signOut()}
        >
          <LogOut aria-hidden="true" />
          Log out
        </Button>
      </div>
    </div>
  )
}
