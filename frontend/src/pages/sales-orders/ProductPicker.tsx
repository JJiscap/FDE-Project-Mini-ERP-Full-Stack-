import { useId, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Search, TriangleAlert } from 'lucide-react'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  parseQuantity,
  productLabel,
  stockWarning,
  useDebouncedValue,
  type Page,
  type ProductChoice,
} from './helpers'

interface ProductPickerProps {
  /** Adds the Product. Return true when it worked, so the picker clears for the next Product. */
  onAdd: (product: ProductChoice, quantity: number) => Promise<boolean> | boolean
  /** True while the parent is saving the line. */
  busy?: boolean
}

/**
 * "Add a product": search active Products, each shown as
 * "ARB-1KG · Arabica, 1 kg bag · 450.00 THB · 170 kg on hand", then type a quantity and Add.
 * A quantity above On Hand only warns: the server checks stock when the order is Confirmed.
 */
export function ProductPicker({ onAdd, busy }: ProductPickerProps) {
  const searchId = useId()
  const quantityId = useId()
  const searchRef = useRef<HTMLInputElement>(null)
  const quantityRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [product, setProduct] = useState<ProductChoice | null>(null)
  const [quantity, setQuantity] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const q = useDebouncedValue(search.trim(), 250)

  const products = useQuery({
    queryKey: ['products', 'list', { q, active: true, picker: true }],
    queryFn: ({ signal }) =>
      api.get<Page<ProductChoice>>('/products', { q, active: true, page_size: 20 }, signal),
    placeholderData: keepPreviousData,
    enabled: product === null,
  })

  const parsed = parseQuantity(quantity)
  const warning = product && parsed.ok ? stockWarning(parsed.value, product.on_hand, product.unit) : null

  async function add() {
    if (!product) return
    if (!parsed.ok) {
      setProblem(parsed.message)
      quantityRef.current?.focus()
      return
    }
    setProblem(null)
    const added = await onAdd(product, parsed.value)
    if (added) {
      setProduct(null)
      setQuantity('')
      setSearch('')
      searchRef.current?.focus()
    }
  }

  if (product) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p className="min-w-0 font-medium break-words" data-testid="chosen-product">
            {productLabel(product)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              setProduct(null)
              setProblem(null)
            }}
          >
            Choose another product
          </Button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-48">
            <Label htmlFor={quantityId} className="mb-1.5 block">
              Quantity ({product.unit})
            </Label>
            <Input
              id={quantityId}
              ref={quantityRef}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={quantity}
              aria-invalid={problem ? true : undefined}
              aria-describedby={`${quantityId}-hint`}
              onChange={(e) => {
                setQuantity(e.target.value)
                setProblem(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void add()
                }
              }}
            />
          </div>
          <Button type="button" size="lg" disabled={busy} onClick={() => void add()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            Add to order
          </Button>
        </div>
        <div id={`${quantityId}-hint`} aria-live="polite" className="min-h-5 text-sm">
          {problem ? (
            <p className="text-danger">{problem}</p>
          ) : warning ? (
            <p className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-warning">
              <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
              {warning}. You can still add it; stock is checked when the order is confirmed.
            </p>
          ) : (
            <p className="text-muted-foreground">Whole units only, for example 20.</p>
          )}
        </div>
      </div>
    )
  }

  const data = products.data
  const updating = products.isFetching && products.isPlaceholderData

  return (
    <div>
      <Label htmlFor={searchId} className="mb-1.5 block">
        Search for a product
      </Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={searchId}
          ref={searchRef}
          type="search"
          className="pl-9"
          placeholder="SKU or name, e.g. ARB"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {updating ? (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-label="Searching"
          />
        ) : null}
      </div>

      {products.isError ? (
        <ErrorAlert error={products.error} onRetry={() => void products.refetch()} className="mt-3" />
      ) : null}

      <div className={cn('mt-2 transition-opacity', updating && 'opacity-60')}>
        {products.isPending ? (
          <p className="py-3 text-sm text-muted-foreground" role="status">
            Loading products...
          </p>
        ) : data && data.items.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            {q ? `No active product matches '${q}'.` : 'There are no active products.'}
          </p>
        ) : data ? (
          <>
            <ul className="divide-y rounded-lg border bg-card" aria-label="Products">
              {data.items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="min-h-12 w-full px-4 py-2.5 text-left break-words hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    onClick={() => {
                      setProduct(p)
                      setQuantity('')
                      setProblem(null)
                    }}
                  >
                    {productLabel(p)}
                  </button>
                </li>
              ))}
            </ul>
            {data.total > data.items.length ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Showing {data.items.length} of {data.total}. Type more to narrow the list.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
