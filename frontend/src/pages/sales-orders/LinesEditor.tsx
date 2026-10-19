import { useId, useState } from 'react'
import { Loader2, Trash2, TriangleAlert } from 'lucide-react'
import { Money } from '@/components/Money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatQty, formatTHB } from '@/lib/format'
import { parseQuantity, stockWarning } from './helpers'

/** One Order Line, whether it is saved yet or not. */
export interface LineRow {
  key: string | number
  sku: string
  name: string
  unit: string
  quantity: number
  unit_price: string
  amount: string
  on_hand: number
}

interface LinesEditorProps {
  lines: LineRow[]
  /** Draft: quantities can change and lines can go. Confirmed and Cancelled: read-only. */
  editable: boolean
  /** Called with a valid new quantity (blur or Enter). Return false when it was refused, to restore the old one. */
  onChangeQuantity?: (key: LineRow['key'], quantity: number) => void | boolean | Promise<boolean | void>
  onRemove?: (key: LineRow['key']) => void
  /** Apply a typed quantity at once (the new-order screen) instead of on blur or Enter. */
  live?: boolean
  /** Line being saved: its controls are disabled. */
  busyKey?: LineRow['key'] | null
}

/**
 * The Order Lines as cards, which fit a phone and a desktop alike. The Unit Price is
 * read-only: it was copied from the Product when the line was added.
 */
export function LinesEditor({ lines, editable, onChangeQuantity, onRemove, live, busyKey }: LinesEditorProps) {
  return (
    <ul className="space-y-2" aria-label="Order lines">
      {lines.map((line) => (
        <LineCard
          key={line.key}
          line={line}
          editable={editable}
          live={live}
          busy={busyKey === line.key}
          onChangeQuantity={onChangeQuantity}
          onRemove={onRemove}
        />
      ))}
    </ul>
  )
}

interface LineCardProps {
  line: LineRow
  editable: boolean
  live?: boolean
  busy: boolean
  onChangeQuantity?: LinesEditorProps['onChangeQuantity']
  onRemove?: LinesEditorProps['onRemove']
}

function LineCard({ line, editable, live, busy, onChangeQuantity, onRemove }: LineCardProps) {
  const inputId = useId()
  const [text, setText] = useState(String(line.quantity))
  const [seen, setSeen] = useState(line.quantity)
  const [problem, setProblem] = useState<string | null>(null)

  // The server (or the parent) changed the quantity: show it.
  if (line.quantity !== seen) {
    setSeen(line.quantity)
    setText(String(line.quantity))
    setProblem(null)
  }

  async function commit() {
    const parsed = parseQuantity(text)
    if (!parsed.ok) {
      setProblem(parsed.message)
      return
    }
    setProblem(null)
    if (parsed.value !== line.quantity) {
      const saved = await onChangeQuantity?.(line.key, parsed.value)
      if (saved === false) setText(String(line.quantity))
    }
  }

  const warning = stockWarning(line.quantity, line.on_hand, line.unit)

  return (
    <li className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-52">
          <p className="font-medium break-words">
            {line.sku} <span className="font-normal text-muted-foreground">· {line.name}</span>
          </p>
          <p className="tabular text-sm text-muted-foreground">
            {formatTHB(line.unit_price)} per {line.unit}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {editable ? (
            <>
              <label htmlFor={inputId} className="sr-only">
                Quantity of {line.sku}
              </label>
              <Input
                id={inputId}
                inputMode="numeric"
                autoComplete="off"
                className="w-24 text-right tabular"
                value={text}
                disabled={busy}
                aria-invalid={problem ? true : undefined}
                onChange={(e) => {
                  setText(e.target.value)
                  setProblem(null)
                  if (live) {
                    const parsed = parseQuantity(e.target.value)
                    if (parsed.ok) onChangeQuantity?.(line.key, parsed.value)
                  }
                }}
                onBlur={() => void commit()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void commit()
                  }
                }}
              />
              <span className="text-sm text-muted-foreground">{line.unit}</span>
            </>
          ) : (
            <span className="tabular">{formatQty(line.quantity, line.unit)}</span>
          )}
        </div>

        <div className="flex min-w-32 items-center justify-end gap-2">
          <Money value={line.amount} strong />
          {editable ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={busy}
              aria-label={`Remove ${line.sku}`}
              onClick={() => onRemove?.(line.key)}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
            </Button>
          ) : null}
        </div>
      </div>

      {problem ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {problem}
        </p>
      ) : null}
      {warning && editable ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-sm text-warning">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      ) : null}
    </li>
  )
}
