# Siam Bean ERP: frontend

Vite + React 19 + TypeScript, Tailwind 4, shadcn/ui (Radix), react-router, TanStack Query, react-hook-form + zod, Vitest.
Supabase is used for **login and session only**. All data comes from the FastAPI backend at `/api/*`.

```bash
cd frontend
npm i
npm run dev          # http://localhost:5173, proxies /api to http://localhost:8000
npm run typecheck && npm test && npm run build
npm run check:bundle # after build: fails if a server secret from .env is inside dist/
```

`.env` lives at the **repo root** (git-ignored). `vite.config.ts` reads it and exposes only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, as `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never add an `envPrefix`. On Vercel the same two names come from the project's environment variables.

> `grep sb_secret dist` matches once: supabase-js contains that prefix in its own key check. That is library code, not a key. Use `npm run check:bundle`, which compares the real secret values.

## Layout

```
src/
  routes.tsx              central route table (one line per module screen)
  App.tsx                 providers, router, guards
  pages/<module>/index.tsx  YOUR folder: default-export the page component
  pages/login, pages/system   login and 404
  components/             shared: PageHeader, EmptyState, ErrorAlert, StatusBadge, Money, DataTable, ConfirmDialog, PageSpinner
  components/ui/          shadcn primitives (button, input, form, select, sheet, ...)
  components/layout/      AppLayout (sidebar / phone drawer), SidebarContent
  auth/                   AuthProvider (useAuth), useMe / useCurrentUser, guards
  lib/                    api.ts, supabase.ts, permissions.ts, format.ts, query-client.ts, utils.ts
```

A module agent edits **only** `src/pages/<module>/` (plus `components/` or `lib/` if something is truly shared).

## Add or build a page

1. Work in `src/pages/<module>/`. `index.tsx` default-exports the page. It is already registered in `src/routes.tsx` and wrapped in the role guard, so no routing changes are needed.
2. Need sub-pages (`/sales-orders/new`, `/sales-orders/:id`)? The route is registered as `/sales-orders/*`, so render `<Routes>` inside your page:
   ```tsx
   <Routes>
     <Route index element={<OrderList />} />
     <Route path="new" element={<OrderForm />} />
     <Route path=":id" element={<OrderDetail />} />
   </Routes>
   ```
3. Start with `<PageHeader title description action />`. One primary button per screen goes in `action`.
4. Every list has an `EmptyState`. Every failed request shows an `ErrorAlert`.

## Calling the API

```ts
import { api } from '@/lib/api'
const page = await api.get<Page<Product>>('/products', { q, page })   // GET /api/products?q=..&page=..
await api.post<Order>('/sales-orders', { customer_id })
await api.patch(`/products/${id}`, { active: false })
```

- The token is attached for you. JSON in, JSON out.
- Failures throw `ApiError { status, detail }`. `detail` is the API's `{"detail": "..."}` message, already human-readable.
- `401` signs the user out and the guard shows `/login`. `403` is thrown to the page boundary, which renders **Access denied** (queries and mutations both). You do not handle either.
- Never call Supabase tables from the browser. Never put money in a float: API money is a string like `"9630.00"`.

## Reading data: TanStack Query

Query keys are arrays, from general to specific, so one `invalidateQueries` refreshes the right lists:

```ts
['products']                          // everything about products
['products', 'list', { q, page }]     // a list page
['products', 'detail', id]            // one product
['dashboard']
```

```tsx
const products = useQuery({ queryKey: ['products', 'list', { q, page }], queryFn: () => api.get<Page<Product>>('/products', { q, page }) })
if (products.isError) return <ErrorAlert error={products.error} onRetry={() => void products.refetch()} />

const confirm = useMutation({
  mutationFn: () => api.post(`/sales-orders/${id}/confirm`),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
    void queryClient.invalidateQueries({ queryKey: ['stock'] })      // confirming changes On Hand ...
    void queryClient.invalidateQueries({ queryKey: ['invoices'] })   // ... and creates an Invoice
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    toast.success('Order confirmed')                                  // import { toast } from 'sonner'
  },
})
// show the API's reason: {confirm.isError ? <ErrorAlert error={confirm.error} /> : null}
```

## Forms: react-hook-form + zod + API errors

Use the shadcn `Form` pattern (see `src/pages/login/index.tsx`). Write validation messages that say what to fix.

```tsx
const schema = z.object({ price: z.coerce.number().min(0, 'Price must be 0 or more') })
const form = useForm({ resolver: zodResolver(schema), defaultValues: { price: 0 } })
const save = useMutation({ mutationFn: (v: z.infer<typeof schema>) => api.post('/products', v) })

<Form {...form}>
  <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
    {save.isError ? <ErrorAlert error={save.error} /> : null}   {/* e.g. 409 "SKU ARB-1KG already exists" */}
    <FormField control={form.control} name="price" render={({ field }) => (
      <FormItem><FormLabel>Price (THB, excluding VAT)</FormLabel>
        <FormControl><Input inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>
    )} />
    <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving...' : 'Save product'}</Button>
  </form>
</Form>
```

Client checks are for convenience. The server is the authority and its message is shown as is. Button labels are verbs ("Save product", "Record payment"), never "Submit" or "OK".

## Who may see and do what

`src/lib/permissions.ts` mirrors the spec role matrix. The menu and route guards read it. Use the helpers to hide buttons:

```tsx
const me = useCurrentUser()                     // { full_name, role, company, ... }
{canEditProducts(me.role) ? <Button>New product</Button> : null}
```

`canAccess(role, screen)`, `canEditProducts`, `canEditCustomers`, `canEditSalesOrders`, `canConfirmOrders`, `canMoveStock`, `canRecordPayments`. Hiding a button is only a convenience: the server returns `403` anyway. To change the matrix, edit `permissions.ts` **and** `permissions.test.ts`.

## Formatting

```ts
import { formatTHB, formatQty, formatDate, formatDateTime, todayInBangkok } from '@/lib/format'
formatTHB('9630.00')      // 9,630.00 THB
formatQty(150, 'kg')      // 150 kg
formatDate('2026-10-22')  // 22 Oct 2026     (timestamps are shown in Asia/Bangkok)
```

In tables use `<Money value={row.total} />` (right-aligned, tabular digits, never wraps). Put `className="tabular"` on any other aligned number.

## Components

| Component | Use |
|---|---|
| `PageHeader` | Title, description, one primary `action` (full width on phones) |
| `EmptyState` | "No customers yet" + what to do next, with an optional action button |
| `ErrorAlert` | Shows `ApiError.detail`; optional "Try again" |
| `StatusBadge` | `draft`, `confirmed`, `cancelled`, `open`, `paid`, `overdue`, `low-stock`, `active`, `inactive`. Icon + label + colour |
| `Money` | THB amounts |
| `DataTable` | Table from 768px, cards on phones. Columns: `header`, `cell`, `align: 'right'` for numbers, `isTitle` for the main text. Pass `empty={<EmptyState .../>}` and `getRowHref` to link rows. Keep buttons out of phone cards |
| `ConfirmDialog` | Before irreversible actions. Title names the thing ("Confirm SO-0012?"), say what happens, label the button with the action. Parent closes it, so it stays open while loading or when the API refuses |
| `PageSpinner` | Loading a whole page or section |
| `AccessDenied` | Rendered for you by guards and the 403 boundary |

## UI rules (see root CLAUDE.md)

- Money `9,630.00 THB`, quantities with unit. Glossary words only: Sales Order, Order Line, Invoice, On Hand, Low Stock, Stock-in.
- Mobile first. No horizontal scroll at 375px: use `min-w-0`, wrap long text, use `DataTable`, stack form fields.
- Inputs are 40px high and 16px text. Do not shrink them. Use `<Label>`/`FormLabel` for every field.
- Colours come from tokens in `src/index.css` (`bg-card`, `text-muted-foreground`, `bg-warning-soft`). No hex values. One accent: the brown `primary`.
- Add shadcn components with `npx shadcn@latest add <name>`, then check that imports read `@/lib/utils`.
