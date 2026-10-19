import { Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Menu } from 'lucide-react'
import { useCurrentUser } from '@/auth/useMe'
import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS } from '@/lib/permissions'
import { AccessBoundary } from '@/components/AccessBoundary'
import { Brand } from '@/components/Brand'
import { PageSpinner } from '@/components/PageSpinner'
import { SidebarContent } from '@/components/layout/SidebarContent'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

/**
 * App shell. From 1024px: a fixed sidebar. Below that: a top bar with a menu
 * button that opens the same menu in a slide-over drawer.
 */
export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()
  const me = useCurrentUser()

  return (
    <div className="min-h-dvh lg:pl-64">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-4 py-2 font-medium text-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4 lg:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Open menu">
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" showCloseButton={false} className="w-72 max-w-[85vw] border-0 bg-sidebar p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Choose a screen</SheetDescription>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>
        <Brand className="min-w-0 text-primary" markClassName="size-7" />
        <div className="ml-auto flex min-w-0 items-center gap-2 text-sm">
          <span className="truncate font-medium">{me.full_name}</span>
          <Badge variant="secondary" className="border-border">{ROLE_LABELS[me.role]}</Badge>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <AccessBoundary resetKey={pathname}>
          <Suspense fallback={<PageSpinner />}>
            <Outlet />
          </Suspense>
        </AccessBoundary>
      </main>
    </div>
  )
}
