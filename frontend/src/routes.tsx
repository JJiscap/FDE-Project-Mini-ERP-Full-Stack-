import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import {
  Boxes,
  Coffee,
  FileText,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Users,
  type LucideProps,
} from 'lucide-react'
import type { Screen } from '@/lib/permissions'

/**
 * THE central route table. One entry per module screen.
 *
 * To add or change a module you only touch its own folder, `src/pages/<module>/`.
 * Its `index.tsx` default-exports the page component. If the module needs
 * sub-pages (e.g. `/sales-orders/new`, `/sales-orders/12`), render a nested
 * `<Routes>` inside the page: the table registers each path with a trailing `/*`.
 */
export interface ModuleRoute {
  screen: Screen
  /** URL path, e.g. `/products`. */
  path: string
  icon: ComponentType<LucideProps>
  Page: LazyExoticComponent<ComponentType>
}

export const MODULE_ROUTES: ModuleRoute[] = [
  { screen: 'dashboard', path: '/', icon: LayoutDashboard, Page: lazy(() => import('@/pages/dashboard')) },
  { screen: 'products', path: '/products', icon: Coffee, Page: lazy(() => import('@/pages/products')) },
  { screen: 'customers', path: '/customers', icon: Users, Page: lazy(() => import('@/pages/customers')) },
  { screen: 'sales-orders', path: '/sales-orders', icon: FileText, Page: lazy(() => import('@/pages/sales-orders')) },
  { screen: 'stock', path: '/stock', icon: Boxes, Page: lazy(() => import('@/pages/stock')) },
  { screen: 'invoices', path: '/invoices', icon: ReceiptText, Page: lazy(() => import('@/pages/invoices')) },
  { screen: 'accounting', path: '/accounting', icon: Landmark, Page: lazy(() => import('@/pages/accounting')) },
]
