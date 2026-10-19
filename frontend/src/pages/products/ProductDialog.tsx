import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorAlert, errorMessage } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, isApiError } from '@/lib/api'
import { productSchema, splitApiErrors, toPayload, type Product, type ProductFormValues } from './schema'

interface ProductDialogProps {
  /** Omit to create a new product. */
  product?: Product
  onClose: () => void
}

/**
 * Create / edit form. Mounted only while open, so it always starts from the right product.
 * Client checks are a convenience: the API's own messages are shown next to the field they belong to.
 */
export function ProductDialog({ product, onClose }: ProductDialogProps) {
  const queryClient = useQueryClient()
  const editing = product !== undefined
  const [otherErrors, setOtherErrors] = useState<string[]>([])

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      unit: product?.unit ?? 'kg',
      price: product?.price ?? '',
      cost: product?.cost ?? '',
      reorder_level: String(product?.reorder_level ?? 0),
    },
  })

  const save = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const payload = toPayload(values)
      if (!editing) return api.post<Product>('/products', payload)
      const { sku: _sku, ...changes } = payload // the SKU is the product's identity: it is not edited here
      return api.patch<Product>(`/products/${product.id}`, changes)
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(editing ? `${saved.sku} saved` : `${saved.sku} created`)
      onClose()
    },
    onError: (error) => {
      if (!isApiError(error) || ![409, 422].includes(error.status)) {
        setOtherErrors([errorMessage(error)])
        return
      }
      const { fields, rest } = splitApiErrors(error.detail)
      for (const [name, message] of Object.entries(fields)) {
        form.setError(name as keyof ProductFormValues, { type: 'server', message })
      }
      setOtherErrors(rest)
    },
  })

  function onSubmit(values: ProductFormValues) {
    setOtherErrors([])
    save.mutate(values)
  }

  return (
    <Dialog open onOpenChange={(open) => (!open && !save.isPending ? onClose() : undefined)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${product.sku}` : 'New product'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Changing the Price does not change Sales Orders or Invoices that already exist.'
              : 'On Hand starts at 0. Record a Stock-in to add stock.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
            {otherErrors.length > 0 ? <ErrorAlert error={otherErrors.join('; ')} /> : null}

            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={editing} autoComplete="off" autoCapitalize="characters" placeholder="ARB-1KG" />
                  </FormControl>
                  {editing ? <FormDescription>The SKU cannot be changed.</FormDescription> : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" placeholder="Arabica, 1 kg bag" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="box">box</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (THB, excluding VAT)</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" autoComplete="off" placeholder="450.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost (THB)</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" autoComplete="off" placeholder="320.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reorder_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder level</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" autoComplete="off" />
                  </FormControl>
                  <FormDescription>Low stock shows when On Hand is below this number.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {editing ? 'Save product' : 'Create product'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
