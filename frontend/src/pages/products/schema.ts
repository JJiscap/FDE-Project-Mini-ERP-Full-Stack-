import { z } from 'zod'

/** One product as `GET /api/products` returns it. Money is a string like "450.00". */
export interface Product {
  id: number
  sku: string
  name: string
  unit: 'kg' | 'box'
  price: string
  cost: string
  reorder_level: number
  active: boolean
  on_hand: number
  low_stock: boolean
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export const PAGE_SIZE = 20

// ------------------------------------------------------------------ form

/** Money typed in a text box: a number, 0 or more, at most 2 decimals. Messages match the API's. */
function moneyField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => /^-?\d+(\.\d+)?$/.test(v), `${label} must be a number`)
    .refine((v) => !(Number(v) < 0), `${label} must be 0 or more`)
    .refine((v) => !/\.\d{3,}$/.test(v), `${label} can have at most 2 decimal places`)
}

export const productSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(40, 'SKU must be at most 40 characters'),
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  unit: z.enum(['kg', 'box'], { error: 'Unit must be kg or box' }),
  price: moneyField('Price'),
  cost: moneyField('Cost'),
  reorder_level: z
    .string()
    .trim()
    .min(1, 'Reorder level is required')
    .refine((v) => /^-?\d+$/.test(v), 'Reorder level must be a whole number')
    .refine((v) => !(Number(v) < 0), 'Reorder level must be 0 or more'),
})

export type ProductFormValues = z.infer<typeof productSchema>

export interface ProductPayload {
  sku: string
  name: string
  unit: 'kg' | 'box'
  price: string
  cost: string
  reorder_level: number
}

/** Form values to the API body. Money stays text so no float ever touches it. */
export function toPayload(values: ProductFormValues): ProductPayload {
  return {
    sku: values.sku,
    name: values.name,
    unit: values.unit,
    price: values.price,
    cost: values.cost,
    reorder_level: Number(values.reorder_level),
  }
}

export type FormField = keyof ProductFormValues

// The API's labels (see backend errors.py `_label`), used to find the field a message belongs to.
const FIELD_LABELS: [string, FormField][] = [
  ['SKU', 'sku'],
  ['Name', 'name'],
  ['Unit', 'unit'],
  ['Price', 'price'],
  ['Cost', 'cost'],
  ['Reorder level', 'reorder_level'],
]

/**
 * The API joins one sentence per wrong field with "; " ("Price must be 0 or more; Cost is required",
 * or "SKU ARB-1KG already exists"). Put each next to its field; whatever cannot be placed goes in `rest`.
 */
export function splitApiErrors(detail: string): { fields: Partial<Record<FormField, string>>; rest: string[] } {
  const fields: Partial<Record<FormField, string>> = {}
  const rest: string[] = []
  for (const message of detail.split('; ').map((m) => m.trim()).filter(Boolean)) {
    const match = FIELD_LABELS.find(([label]) => message === label || message.startsWith(`${label} `))
    if (match && !fields[match[1]]) fields[match[1]] = message
    else rest.push(message)
  }
  return { fields, rest }
}

// --------------------------------------------------------------- filters

export type StatusFilter = 'active' | 'inactive' | 'all'

export interface Filters {
  q: string
  status: StatusFilter
  lowStock: boolean
  page: number
}

/** `?q=arb&active=all&low_stock=true&page=2`. Anything missing falls back to the default. */
export function paramsToFilters(params: URLSearchParams): Filters {
  const active = params.get('active')
  const page = Number(params.get('page'))
  return {
    q: params.get('q') ?? '',
    status: active === 'all' ? 'all' : active === 'false' ? 'inactive' : 'active',
    lowStock: params.get('low_stock') === 'true',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

export function filtersToParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.status === 'all') params.set('active', 'all')
  if (filters.status === 'inactive') params.set('active', 'false')
  if (filters.lowStock) params.set('low_stock', 'true')
  if (filters.page > 1) params.set('page', String(filters.page))
  return params
}

/** The query string the API wants (`active=true|false`, omitted for All). */
export function filtersToApiQuery(filters: Filters) {
  return {
    q: filters.q || undefined,
    active: filters.status === 'all' ? undefined : filters.status === 'active',
    low_stock: filters.lowStock ? true : undefined,
    page: filters.page,
    page_size: PAGE_SIZE,
  }
}
