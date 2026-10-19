import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorAlert } from '@/components/ErrorAlert'
import { SegmentedControl } from '@/components/SegmentedControl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import {
  parseQuantity,
  productLabel,
  successMessage,
  type MovementType,
  type RecordedMovement,
  type StockProduct,
} from './helpers'

const TYPES: { value: MovementType; label: string }[] = [
  { value: 'in', label: 'Stock-in' },
  { value: 'out', label: 'Stock-out' },
  { value: 'adjust', label: 'Adjustment' },
]

const COPY: Record<MovementType, { hint: string; quantity: string; reason: string; button: string; placeholder: string }> = {
  in: {
    hint: 'Beans arrived. Adds to On Hand.',
    quantity: 'Quantity received',
    reason: 'Note (optional)',
    button: 'Record Stock-in',
    placeholder: 'e.g. delivery from the farm',
  },
  out: {
    hint: 'Beans leaving without a Sales Order (samples, write-offs). Enter the quantity as a positive number.',
    quantity: 'Quantity leaving',
    reason: 'Reason (required)',
    button: 'Record Stock-out',
    placeholder: 'e.g. samples for a new café',
  },
  adjust: {
    hint: 'Correct On Hand after a count. Enter the difference, not the counted quantity: -3 removes 3, 4 adds 4.',
    quantity: 'Difference (use - to remove)',
    reason: 'Reason (required)',
    button: 'Record Adjustment',
    placeholder: 'e.g. damaged bags',
  },
}

interface MovementFormProps {
  products: StockProduct[]
  productId: string
  onProductChange: (id: string) => void
}

export function MovementForm({ products, productId, onProductChange }: MovementFormProps) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<MovementType>('in')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ product?: string; quantity?: string; reason?: string }>({})

  const product = products.find((p) => String(p.id) === productId)
  const copy = COPY[type]
  const reasonRequired = type !== 'in'

  const record = useMutation({
    mutationFn: (body: { product_id: number; movement_type: MovementType; quantity: number; reason: string | null }) =>
      api.post<RecordedMovement>('/stock/movements', body),
    onSuccess: (movement, body) => {
      const picked = products.find((p) => p.id === body.product_id)
      if (picked) toast.success(successMessage(movement.ref_doc, picked, movement.on_hand))
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setQuantity('')
      setReason('')
    },
  })

  function changeType(next: MovementType) {
    setType(next)
    setFieldErrors({})
    record.reset()
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const errors: typeof fieldErrors = {}
    if (!product) errors.product = 'Choose a Product'
    const parsed = parseQuantity(quantity, type)
    if (!parsed.ok) errors.quantity = parsed.message
    if (reasonRequired && reason.trim() === '') errors.reason = 'Reason is required for a stock-out or adjustment'
    setFieldErrors(errors)
    if (!product || !parsed.ok || errors.reason) return
    record.mutate({
      product_id: product.id,
      movement_type: type,
      quantity: parsed.value,
      reason: reason.trim() || null,
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <SegmentedControl ariaLabel="Movement type" options={TYPES} value={type} onChange={changeType} />
      <p className="text-sm text-muted-foreground">{copy.hint}</p>

      {record.isError ? <ErrorAlert error={record.error} /> : null}

      <div className="space-y-2">
        <Label htmlFor="stock-product">Product</Label>
        <Select
          value={productId}
          onValueChange={(id) => {
            onProductChange(id)
            setFieldErrors((e) => ({ ...e, product: undefined }))
            record.reset()
          }}
        >
          <SelectTrigger
            id="stock-product"
            className="h-10 w-full"
            aria-invalid={Boolean(fieldErrors.product)}
            aria-describedby={fieldErrors.product ? 'stock-product-error' : undefined}
          >
            <SelectValue placeholder="Choose a Product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {productLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.product ? (
          <p id="stock-product-error" role="alert" className="text-sm text-destructive">
            {fieldErrors.product}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="stock-quantity">
          {copy.quantity}
          {product ? ` (${product.unit})` : ''}
        </Label>
        <Input
          id="stock-quantity"
          inputMode={type === 'adjust' ? 'text' : 'numeric'}
          autoComplete="off"
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value)
            setFieldErrors((f) => ({ ...f, quantity: undefined }))
          }}
          aria-invalid={Boolean(fieldErrors.quantity)}
          aria-describedby={fieldErrors.quantity ? 'stock-quantity-error' : undefined}
        />
        {fieldErrors.quantity ? (
          <p id="stock-quantity-error" role="alert" className="text-sm text-destructive">
            {fieldErrors.quantity}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="stock-reason">{copy.reason}</Label>
        <Textarea
          id="stock-reason"
          rows={2}
          value={reason}
          placeholder={copy.placeholder}
          onChange={(e) => {
            setReason(e.target.value)
            setFieldErrors((f) => ({ ...f, reason: undefined }))
          }}
          aria-invalid={Boolean(fieldErrors.reason)}
          aria-describedby={fieldErrors.reason ? 'stock-reason-error' : undefined}
        />
        {fieldErrors.reason ? (
          <p id="stock-reason-error" role="alert" className="text-sm text-destructive">
            {fieldErrors.reason}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="h-11 w-full sm:w-auto" disabled={record.isPending}>
        {record.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {record.isPending ? 'Recording...' : copy.button}
      </Button>
    </form>
  )
}
