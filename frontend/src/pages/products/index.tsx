import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Coffee, Plus, Search, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/auth/useMe'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable, type Column } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { formatQty } from '@/lib/format'
import { canEditProducts } from '@/lib/permissions'
import { ProductDialog } from './ProductDialog'
import {
  filtersToApiQuery,
  filtersToParams,
  paramsToFilters,
  type Filters,
  type Page,
  type Product,
  type StatusFilter,
} from './schema'

const SEARCH_DELAY_MS = 300

export default function ProductsPage() {
  const me = useCurrentUser()
  const canEdit = canEditProducts(me.role)
  const queryClient = useQueryClient()

  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => paramsToFilters(params), [params])
  const [search, setSearch] = useState(filters.q)
  const [dialog, setDialog] = useState<{ product?: Product } | null>(null)
  const [toggling, setToggling] = useState<Product | null>(null)

  function change(next: Partial<Filters>) {
    // Built from the latest address, so a search that fires late never undoes another filter.
    setParams((current) => filtersToParams({ ...paramsToFilters(current), page: 1, ...next }), { replace: true })
  }

  // Typing filters the list after a short pause, so each keystroke is not a request.
  useEffect(() => {
    if (search.trim() === filters.q) return
    const timer = setTimeout(() => change({ q: search.trim() }), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const products = useQuery({
    queryKey: ['products', 'list', filters],
    queryFn: ({ signal }) => api.get<Page<Product>>('/products', filtersToApiQuery(filters), signal),
    placeholderData: keepPreviousData,
  })

  const setActive = useMutation({
    mutationFn: (product: Product) => api.patch<Product>(`/products/${product.id}`, { active: !product.active }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(saved.active ? `${saved.sku} reactivated` : `${saved.sku} deactivated`)
      setToggling(null)
    },
  })

  const data = products.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  const columns: Column<Product>[] = [
    { header: 'SKU', isTitle: true, cell: (p) => <span className="font-mono">{p.sku}</span> },
    { header: 'Name', cell: (p) => <span className="break-words">{p.name}</span> },
    { header: 'Unit', cell: (p) => p.unit },
    { header: 'Price', align: 'right', cell: (p) => <Money value={p.price} /> },
    {
      header: 'On Hand',
      align: 'right',
      cell: (p) => <span className="tabular whitespace-nowrap">{formatQty(p.on_hand, p.unit)}</span>,
    },
    {
      header: 'Status',
      cell: (p) => (
        <span className="inline-flex flex-wrap justify-end gap-1.5 md:justify-start">
          {p.active ? <StatusBadge status="active" /> : <StatusBadge status="inactive" />}
          {p.low_stock ? <StatusBadge status="low-stock" /> : null}
        </span>
      ),
    },
  ]
  if (canEdit) {
    columns.push({
      header: 'Actions',
      align: 'right',
      cell: (p) => (
        <span className="inline-flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ product: p })}>
            Edit<span className="sr-only"> {p.sku}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setActive.reset()
              setToggling(p)
            }}
          >
            {p.active ? 'Deactivate' : 'Reactivate'}
            <span className="sr-only"> {p.sku}</span>
          </Button>
        </span>
      ),
    })
  }

  const newProductButton = canEdit ? (
    <Button type="button" onClick={() => setDialog({})}>
      <Plus aria-hidden="true" />
      New product
    </Button>
  ) : undefined

  return (
    <>
      <PageHeader
        title="Products"
        description="What Siam Bean sells, with On Hand and Low Stock."
        action={newProductButton}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU or name"
            aria-label="Search products by SKU or name"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filters.status} onValueChange={(status) => change({ status: status as StatusFilter })}>
            <SelectTrigger className="min-w-0 flex-1 sm:w-36 sm:flex-none" aria-label="Show products">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={filters.lowStock ? 'default' : 'outline'}
            aria-pressed={filters.lowStock}
            className="h-10 flex-1 sm:flex-none"
            onClick={() => change({ lowStock: !filters.lowStock })}
          >
            <TrendingDown aria-hidden="true" />
            Low stock only
          </Button>
        </div>
      </div>

      {products.isError ? (
        <ErrorAlert error={products.error} onRetry={() => void products.refetch()} className="mb-4" />
      ) : null}
      {setActive.isError ? <ErrorAlert error={setActive.error} className="mb-4" /> : null}

      <DataTable
        caption="Products"
        columns={columns}
        rows={data?.items}
        getRowKey={(p) => p.id}
        isLoading={products.isPending}
        empty={<ProductsEmpty filters={filters} canEdit={canEdit} onNew={() => setDialog({})} />}
      />

      {data && data.total > 0 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {(data.page - 1) * data.page_size + 1}-{(data.page - 1) * data.page_size + data.items.length} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={filters.page <= 1}
              onClick={() => change({ page: filters.page - 1 })}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={filters.page >= totalPages}
              onClick={() => change({ page: filters.page + 1 })}
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null}

      {dialog ? <ProductDialog product={dialog.product} onClose={() => setDialog(null)} /> : null}

      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(open) => (!open ? setToggling(null) : undefined)}
        title={toggling ? `${toggling.active ? 'Deactivate' : 'Reactivate'} ${toggling.sku}?` : ''}
        description={
          toggling?.active
            ? 'It will no longer be offered on new Sales Orders. Existing orders, invoices and stock history keep it, and you can reactivate it later.'
            : 'It will be offered on new Sales Orders again.'
        }
        confirmLabel={toggling?.active ? 'Deactivate product' : 'Reactivate product'}
        destructive={toggling?.active}
        loading={setActive.isPending}
        onConfirm={() => (toggling ? setActive.mutate(toggling) : undefined)}
      />
    </>
  )
}

function ProductsEmpty({ filters, canEdit, onNew }: { filters: Filters; canEdit: boolean; onNew: () => void }) {
  if (filters.q) {
    return (
      <EmptyState
        icon={Search}
        title={`No products match '${filters.q}'`}
        description="Check the spelling, or try part of the SKU or name."
      />
    )
  }
  if (filters.lowStock) {
    return <EmptyState icon={TrendingDown} title="No products are low on stock" description="Every product is at or above its reorder level." />
  }
  if (filters.status === 'inactive') {
    return <EmptyState icon={Coffee} title="No deactivated products" description="Products you deactivate will be listed here." />
  }
  return (
    <EmptyState
      icon={Coffee}
      title="No products yet"
      description={canEdit ? 'Add your first product to start selling.' : 'The Admin has not added any products yet.'}
      action={
        canEdit ? (
          <Button type="button" onClick={onNew}>
            <Plus aria-hidden="true" />
            New product
          </Button>
        ) : undefined
      }
    />
  )
}
